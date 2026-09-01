import joplin from 'api';
import { ContentScriptType } from 'api/types';

joplin.plugins.register({
	onStart: async function() {
		await joplin.contentScripts.register(
			ContentScriptType.CodeMirrorPlugin,
			'com.aronwu.search-match-count.contentScript',
			'./contentScript.js',
		);
	},
});
