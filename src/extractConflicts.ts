import { enableHotReload, hotClass, registerUpdateReconciler } from "@hediet/node-reload";
import simpleGit, { GitResponseError, MergeResult, SimpleGit, SimpleGitOptions } from "simple-git";
import * as path from "path";
import * as fs from "fs";

//registerUpdateReconciler(module);

//@hotClass(module)
export class ConflictExtractor {
	async extractConflicts(repoDir: string, targetDir: string) {
		targetDir = path.resolve(process.cwd(), targetDir);
		repoDir = path.resolve(process.cwd(), repoDir);

		const options: Partial<SimpleGitOptions> = {
			baseDir: repoDir,
			binary: "git",
			maxConcurrentProcesses: 6,
			trimmed: false,
		};

		fs.mkdirSync(targetDir, { recursive: true });

		const git: SimpleGit = simpleGit(options);

		const log = await git.log(["main", "--merges"]);
		const conflictingCommits = log.all.filter((l) => l.body.toLowerCase().indexOf("conflicts") !== -1);

		for (const commit of conflictingCommits) {
			const commitDir = path.join(targetDir, commit.hash);
			const completedPath = path.join(commitDir, "completed.txt");
			const errorPath = path.join(commitDir, "error.txt");

			if (fs.existsSync(completedPath)) {
				continue;
			}

			const result = await git.show(["-s", "--pretty=%P", commit.hash]);
			const parents = result.trim().split(" ");

			try {
				await git.checkout([parents[0], "--force"]);
				try {
					await git.merge([parents[1]]);
				} catch (e) {
					if (e instanceof GitResponseError) {
						const r = e.git as MergeResult;

						for (const c of r.conflicts) {
							if (!c.file) {
								continue;
							}
							const conflictNameDir = path.join(commitDir, toValidFileName(c.file));
							fs.mkdirSync(conflictNameDir, { recursive: true });

							function writeFile(fileName: string, content: string) {
								fs.writeFileSync(path.join(conflictNameDir, fileName), content, { encoding: "utf8" });
							}

							const base = await git.show([":1:" + c.file]);
							const yours = await git.show([":2:" + c.file]);
							const theirs = await git.show([":3:" + c.file]);
							const current = fs.readFileSync(path.join(repoDir, c.file), { encoding: "utf-8" });
							const resolved = await git.show([commit.hash + ":" + c.file]);

							const extension = path.extname(c.file);

							writeFile(`base` + extension, base);
							writeFile(`input1` + extension, yours);
							writeFile(`input2` + extension, theirs);
							writeFile(`result` + extension, current);
							writeFile(`resolved` + extension, resolved);
						}
					} else {
						console.error(e);
					}

					fs.writeFileSync(completedPath, "", { encoding: "utf8" });
				}
			} catch (e) {
				console.error(e);
				fs.writeFileSync(errorPath, (e as any).message, { encoding: "utf8" });
			}
		}
	}
}

function toValidFileName(value: string): string {
	return value.replace(/[^a-zA-Z0-9_]/g, "_");
}
