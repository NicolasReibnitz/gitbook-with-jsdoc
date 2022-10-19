import { useModel, useModelCollection } from '@vuemodel/supabase/src/main';
import { Notify } from 'quasar';
import { computed } from 'vue';

import Asset from 'models/Asset';
import AssetSlide from 'models/AssetSlide';
import Chapter from 'models/Chapter';
import Feedback from 'models/Feedback';
import GlobalState from 'models/GlobalState';
import Language from 'models/Language';
import Project from 'models/Project';
import Quiz from 'models/Quiz';
import Slide from 'models/Slide';
import TextSlide from 'models/TextSlide';
import Todo from 'models/Todo';
import User from 'models/User';
import Video from 'models/Video';

import { log } from 'boot/logger.js';

const showSuccessNotification = false;

/**
 * Returns the model for the given model name.
 *
 * @param {string} model The name of the model we want (e.g. 'Project')
 * @returns {Function} The model class
 */
function getModel(model) {
	const models = {
		Asset: Asset,
		AssetSlide: AssetSlide,
		Chapter: Chapter,
		GlobalState: GlobalState,
		Language: Language,
		Project: Project,
		Quiz: Quiz,
		Feedback: Feedback,
		Slide: Slide,
		TextSlide: TextSlide,
		Todo: Todo,
		User: User,
		Video: Video
	};

	return models[model];
}

/**
 * Initialize the database helpers. This should be called in the setup of a component. It returns the helper functions..
 *
 * @returns {object} Object containing the database helpers
 */

function useDBHelpers(modelName) {
	const model = getModel(modelName);
	const origin = new Error().stack
		.split('\n')[2]
		.trim()
		.split('(')[1]
		.replace(/.*\//, '')
		.replace(/:.*/, '')
		.replace(/\?.*/, '');

	// console.trace('useDBHelpers', modelName);
	// eslint-disable-next-line no-caller
	// console.log('caller:', arguments.callee.caller.toString());
	// console.log(new Error('dude').stack.split('\n')[2].trim().split(' ')[1]);
	// console.log(new Error().stack.split('\n')[2].trim());
	// console.log(
	// 	new Error().stack.split('\n')[2].trim().split('(')[1].replace(/.*\//, '').replace(/:.*/, '').replace(/\?.*/, '')
	// );
	// console.log(new Error('dude').stack);

	const service = useModel(model);
	const serviceCollection = useModelCollection(model);

	async function fetch(id, query) {
		if (typeof id === 'number') {
			serviceCollection.ids.value = [id];
		} else if (Array.isArray(id)) {
			serviceCollection.ids.value = id;
		}

		if (typeof query === 'undefined') {
			const relations = getRelations(modelName.toLowerCase(), model);
			query = relations;
		}
		serviceCollection.query.with(query);
		await serviceCollection.index();

		if (serviceCollection.error.value) {
			handleError('read', modelName, 'model', 'could not be indexed!', [
				`\n  ORIGIN: ${origin}\n `,
				serviceCollection.error.value.message,
				'\n ',
				serviceCollection.error.value
			]);
			return false;
		} else {
			const collectionUnrefed = getUnrefed(serviceCollection.collection.value);
			handleSuccess('read', modelName, 'model', 'was indexed!', [
				'\nORIGIN:',
				origin,
				'\nresults:',
				collectionUnrefed.length === 1 ? collectionUnrefed[0] : collectionUnrefed
			]);
			// console.trace();
			// console.error('dude');

			return true;
		}
	}

	/**
	 * Use this to create a new record in the database as well as in the internal store.
	 *
	 * @param {object} values Object containing the values to be used
	 * @param {boolean} verbose Whether to show the result of the fetch, even if it was successful
	 * @returns {Promise<object|boolean>} Returns a promise that resolves to an object of the new record if the record was created successfully, false otherwise
	 */
	async function create(values, verbose = true) {
		service.resetForm();
		service.form.value = {
			...values
		};
		const formValueUnrefed = getUnrefed(service.form.value);
		let modelTitle = formValueUnrefed
			? formValueUnrefed.title || formValueUnrefed.name || formValueUnrefed.type
			: '';

		if (typeof modelTitle === 'string') {
			modelTitle = `"${modelTitle.trim()}"`;
		}

		await service.create();
		if (service.error.value) {
			handleError('create', modelName, modelTitle, 'could not be created!', [
				`\n  ORIGIN: ${origin}\n `,
				service.error.value.message,
				'\n ',
				service.error.value,
				'\npayload:',
				formValueUnrefed
			]);
			return false;
		} else {
			if (verbose) {
				handleSuccess('create', modelName, modelTitle, 'was created!', [
					'\nORIGIN:',
					origin,
					'\npayload:',
					formValueUnrefed
				]);
			}

			return service.model.value;
		}
	}

	/**
	 * Use this to update a record in the database as well as in the internal store.
	 *
	 * @param {number} modelID The ID of the record to be updated
	 * @param {object} values Object containing the values to be updated
	 * @param {boolean} verbose Whether to show the result of the update, even if it was successful
	 * @returns {Promise<boolean>} Returns a promise that resolves to true if the update was successful, false otherwise
	 */
	async function update(modelID, values, verbose = true) {
		const modelData = computed(() => model.find(modelID));
		service.id.value = modelID;
		await service.find();

		const modelDataUnrefed = getUnrefed(modelData.value);
		const modelTitle = modelDataUnrefed
			? modelDataUnrefed.title || modelDataUnrefed.name || `#${modelDataUnrefed.id}`
			: `#${modelID}`;

		service.resetForm();
		service.form.value = {
			...values
		};

		const formValueUnrefed = getUnrefed(service.form.value);

		if (!modelData.value) {
			handleError('index', modelName, modelTitle, 'was not found!', [
				`\n  ORIGIN: ${origin}`,
				'\n  results:',
				modelDataUnrefed,
				'\n  payload:',
				formValueUnrefed
			]);
			return false;
		} else {
			await service.update();

			if (service.error.value) {
				handleError('update', modelName, modelTitle, 'could not be updated!', [
					`\n  ORIGIN: ${origin}\n `,
					service.error.value.message,
					'\n ',
					service.error.value,
					'\n  results:',
					modelDataUnrefed,
					'\n  payload:',
					formValueUnrefed
				]);
				return false;
			} else {
				if (verbose) {
					handleSuccess('update', modelName, modelTitle, 'was updated!', [
						`\n  ORIGIN: ${origin}\n `,
						'\n  results:',
						service.model.value,
						'\n  payload:',
						formValueUnrefed
					]);
				}
				return service.model.value;
			}
		}
	}

	/**
	 * Deletes a record from the database as well as from the internal store.
	 *
	 * @param {number} modelID The ID of the model to be deleted
	 * @returns {Promise<boolean>} Returns a promise that resolves to true if the delete was successful, false otherwise
	 */
	async function drop(modelID) {
		const modelData = computed(() => model.query().withAll().find(modelID));

		service.id.value = modelID;
		await service.find();

		const modelDataUnrefed = getUnrefed(modelData.value);

		const modelTitle = modelDataUnrefed
			? modelDataUnrefed.title || modelDataUnrefed.name || `#${modelDataUnrefed.id}`
			: `#${modelID}`;

		if (!modelData.value) {
			handleError('index', modelName, modelTitle, 'was not found!', [`\n  ORIGIN: ${origin}`]);
			return false;
		} else {
			// model.delete(modelID);
			// model.deleteAll();
			// const theModel = model.query().withAll().find(modelID);
			// theModel.$delete();
			// console.log('theModel: ', theModel);

			await service.remove();
			// console.log('modelDataUnrefed: ', modelDataUnrefed);
			// Object.keys(modelDataUnrefed).forEach(key => {
			// 	console.log(`${key}: ${modelDataUnrefed[key]}`, modelDataUnrefed[key], typeof modelDataUnrefed[key]);
			// });
			// console.log('modelData: ', modelData.value);
			if (service.error.value) {
				handleError('delete', modelName, modelTitle, 'could not be deleted!', [
					`\n  ORIGIN: ${origin}\n `,
					service.error.value.message,
					'\n ',
					service.error.value,
					'\nresults:',
					modelDataUnrefed
				]);
				return false;
			} else {
				handleSuccess('delete', modelName, modelTitle, 'was deleted!', [
					'\nORIGIN:',
					origin,
					'\nresults:',
					modelDataUnrefed
				]);
				return true;
			}
		}
	}

	async function createChapter(projectID, chapterType, chapterTitle, chapterNumber) {
		if (modelName !== 'Chapter') {
			handleError(
				'create',
				modelName,
				chapterTitle,
				`could not be created!\nThis helper does not use a Chapter model! It uses a ${modelName} model.`,
				[`\n  ORIGIN: ${origin}`]
			);
			return false;
		}
		chapterType = chapterType || 'standard';
		chapterNumber = typeof chapterNumber !== 'undefined' ? chapterNumber : getNewChapterNumber(projectID);
		chapterTitle = chapterTitle || `Chapter ${chapterNumber}`;
		const chapterFormValues = {
			type: chapterType,
			title: chapterTitle,
			project_id: projectID,
			number: chapterNumber,
			slide_order: []
		};
		return await create(chapterFormValues);
	}

	async function createSlide(chapterID, type, slideTitle, slideNumber, verbose = true) {
		if (modelName !== 'Slide') {
			handleError(
				'create',
				modelName,
				type,
				`could not be created!\nThis helper does not use a Slide model! It uses a ${modelName} model.`,
				[`\n  ORIGIN: ${origin}`]
			);
			return false;
		}
		slideNumber = slideNumber || getNewSlideNumber(chapterID);
		slideTitle = slideTitle || `Slide ${slideNumber}`;
		const slideFormValues = {
			title: slideTitle,
			chapter_id: chapterID,
			number: slideNumber,
			type
		};
		return await create(slideFormValues, verbose);
	}

	async function createAsset(slideID, type, filePath, transform = null) {
		if (modelName !== 'Asset') {
			handleError(
				'create',
				modelName,
				type,
				`could not be created!\nThis helper does not use an Asset model! It uses a ${modelName} model.`,
				[`\n  ORIGIN: ${origin}\n `]
			);
			return false;
		}

		const assetFormValues = {
			type,
			slide_id: slideID,
			file_path: filePath,
			transform
		};

		return await create(assetFormValues);
	}

	async function createSlideRelations(type, slideID, assetFilePath) {
		if (type === 'video') {
			upsertVideoRelations(slideID, assetFilePath);
		} else if (type === 'quiz') {
			await create({
				slide_id: slideID,
				header: 'Multiple Choice Quiz',
				subheader:
					'This is a placeholder question. Out of the options, which is the correct answer to the question?',
				answer_1: 'Answer A',
				answer_2: 'Answer B',
				answer_3: 'Answer C',
				answer_4: 'Answer D',
				answer_5: 'Answer E',
				answer_1_correct: true,
				answer_2_correct: true,
				answer_3_correct: true,
				answer_4_correct: true,
				answer_5_correct: true
			});

			await create({
				slide_id: slideID,
				header_text: 'Multiple Choice Quiz',
				subheader_text:
					'This is a placeholder question. Out of the options, which is the correct answer to the question?',
				header_align: 'left'
			});
		} else if (type === 'text') {
			await create(
				{
					slide_id: slideID,
					header_text: 'The text slide',
					subheader_text: 'Kitchen sink of the mind',
					body_text:
						'<b>This is the <u>perfect</u> place to put the words corresponding to the message that you are<br />trying to convey!</b>&nbsp;<div><br></div><div>Or not! Totally up to you!<br><br><font size="1"><i>But if you wanted to, you could put them here,<br />is what I\'m saying.</i></font></div>',
					layout_class: 'v-image-text',
					header_align: 'left'
				},
				false
			);
		} else if (type === 'start') {
			await create({
				slide_id: slideID,
				header_text: 'Welcome to the "Proactive Touchpoint Domination" course!',
				subheader_text:
					'In the next 4 hours, you will learn everything about organically growing the holistic world view of disruptive innovation via workplace diversity.',
				body_text: '',
				layout_class: 'f-image',
				header_align: 'center'
			});
		} else if (type === 'end') {
			await create({
				slide_id: slideID,
				header_text: 'Congratulations!',
				subheader_text: 'You successfully completed the "Proactive Touchpoint Domination" course.',
				body_text: '',
				layout_class: 'f-image',
				header_align: 'center'
			});
		}
	}
	async function upsertVideoRelations(slideID, assetFilePath) {
		await createAsset(slideID, 'video', assetFilePath);
	}

	async function deleteAssetViaPath(path) {
		if (modelName !== 'Asset') {
			handleError(
				'delete',
				modelName,
				path,
				`could not be deleted!\nThis helper does not use an Asset model! It uses a ${modelName} model.`,
				[`\n  ORIGIN: ${origin}`]
			);
			return false;
		}

		const assets = computed(() => Asset.all());
		for (const asset of assets.value) {
			if (asset.file_path === path) {
				await drop(asset.id);
			}
		}
	}

	async function deleteAssetViaType(slideID, type) {
		if (modelName !== 'Asset') {
			handleError(
				'delete',
				modelName,
				type,
				`could not be deleted!\nThis helper does not use an Asset model! It uses a ${modelName} model.`,
				[`\n  ORIGIN: ${origin}`]
			);
			return false;
		}

		const assets = computed(() => Asset.query().where('slide_id', slideID).get());

		for (const asset of assets.value) {
			console.log('asset: ', asset);
			console.log('asset: ', asset.type);

			if (asset.type === type) {
				console.log('GONA DELETE asset.id: ', asset.id);
				await drop(asset.id);
			}
		}
	}

	function getNewChapterNumber(projectID) {
		const Project = getModel('Project');
		const project = computed(() =>
			Project.query()
				.with('chapters', query => {
					query.orderBy('number', 'asc');
				})
				.find(projectID)
		);

		if (project.value.chapters && project.value.chapters.length) {
			return project.value.chapters[project.value.chapters.length - 1].number + 1;
		} else {
			return 1;
		}
	}

	function getNewSlideNumber(chapterID) {
		const Chapter = getModel('Chapter');
		const chapter = computed(() => {
			const chapters = Chapter.query()
				.with('slides', query => {
					query.orderBy('number', 'asc');
				})
				.find(chapterID);
			if (chapters) {
				if (chapters.slide_order) {
					chapters.slides.sort(function (a, b) {
						return chapters.slide_order.indexOf(a.id) - chapters.slide_order.indexOf(b.id);
					});
				} else {
					chapters.slide_order = [];
				}
			}
			return chapters;
		});

		if (chapter.value.slides && chapter.value.slides.length) {
			return chapter.value.slides[chapter.value.slides.length - 1].number + 1;
		} else {
			return 1;
		}
	}

	return {
		fetch,
		create,
		update,
		drop,
		createChapter,
		createSlide,
		createAsset,
		createSlideRelations,
		deleteAssetViaPath,
		deleteAssetViaType,
		service
	};
}

/**
 * Responsible for logging errors to the console and displaying a notification.
 *
 * @param {string} action The action that was performed (e.g. 'delete')
 * @param {string} modelType The model type that was affected (e.g. 'Project')
 * @param {string} modelIdentifier An identifier for the record that was affected (e.g. '#123' or 'My Project')
 * @param {string} messageDetail A string that describes what went wrong (e.g. 'could not be deleted')
 * @param {any} data Any other data that should end up in the log
 */
function handleError(action, modelType, modelIdentifier, messageDetail, data = []) {
	const messageText = `ERROR: ${modelType} ${modelIdentifier} ${messageDetail}`;
	const captionText = typeof data[0] === 'string' ? data[0] : '';

	log.error({
		tag: 'Model',
		detail: action,
		message: modelType,
		args: [`\n  ${messageText}`, ...data]
	});

	Notify.create({
		type: 'negative',
		message: messageText,
		caption: captionText
	});
}

/**
 * Responsible for logging success to the console and displaying a notification.
 *
 * @param {string} action The action that was performed (e.g. 'delete')
 * @param {string} modelType The model type that was affected (e.g. 'Project')
 * @param {string} modelIdentifier An identifier for the record that was affected (e.g. '#123' or 'My Project')
 * @param {string} messageDetail A string that describes what succeeded (e.g. 'could not be deleted')
 * @param {any} data Any other data that should end up in the log
 */
function handleSuccess(action, modelType, modelIdentifier, messageDetail, data = []) {
	const messageText = `SUCCESS: ${modelType} ${modelIdentifier} ${messageDetail}`;
	const captionText = typeof data[0] === 'string' ? data[0] : '';

	log.success({
		tag: 'Model',
		detail: action,
		message: modelType,
		args: [`\n${messageText}`, ...data]
	});

	if (showSuccessNotification) {
		Notify.create({
			type: 'positive',
			message: messageText,
			caption: captionText
		});
	}
}

/**
 * Takes a reference to an object and returns a standard "unrefed" copy of it.
 *
 * @param {object} data The data to be converted from reference to standard object
 * @returns {object} The converted data
 */
function getUnrefed(data) {
	return JSON.parse(JSON.stringify(data));
}

function getRelations(rootModelName, model, modelName, parent) {
	const modelFields = model.prototype.constructor.fields();

	const relations = [];

	for (const field in modelFields) {
		if (Object.hasOwnProperty.call(modelFields, field)) {
			const element = modelFields[field];
			if (element.related) {
				let fieldString;
				if (modelName) {
					fieldString = modelName + '.' + field;
				} else {
					fieldString = field;
				}
				const deeperRelations = getRelations(rootModelName, element.related, fieldString, modelName);

				relations.push(fieldString, ...deeperRelations);
			} else if (
				element.foreignKey &&
				parent?.split('.')[parent?.split('.').length - 1] !== element.parent.entity &&
				field !== rootModelName
			) {
				let fieldString;
				if (modelName) {
					fieldString = modelName + '.' + field;
				} else {
					fieldString = field;
				}
				relations.push(fieldString);
			}
		}
	}
	return relations;
}

export { useDBHelpers };
