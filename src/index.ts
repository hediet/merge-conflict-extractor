import { enableHotReload } from "@hediet/node-reload";

enableHotReload();

import {
	types,
	runDefaultCli,
	cliInfoFromPackageJson,
	namedParam,
	positionalParam,
	createDefaultCli,
} from "@hediet/cli";
import { join } from "path";
import { ConflictExtractor } from "./extractConflicts";


interface CmdData {
	run(): Promise<void>;
}

const cli = createDefaultCli<CmdData>().addCmd({
	name: "extract",
	description: "Extracts merge conflicts.",
	positionalParams: [
		positionalParam("repository", types.string, {
			description: "The path to the repository.",
		}),
        positionalParam("targetDir", types.string, {
			description: "The path to the target directory where the conflicts are dumped.",
		}),
	],

	getData: (args) => ({
		async run() {
            const c = new ConflictExtractor();
			await c.extractConflicts(args.repository, args.targetDir);
		},
	}),
});

runDefaultCli({
	info: cliInfoFromPackageJson(join(__dirname, "../package.json")),
	cli,
	dataHandler: (data) => data.run(),
});
