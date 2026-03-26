import { exec, type ExecOptions } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import archiver from "archiver";

type ProcessOutputOptions = ExecOptions & {
  noLogCommand?: boolean;
  noLogStdOut?: boolean;
  noLogStdErr?: boolean;
};

type PackageMetadata = {
  name: string;
  version: string;
};

export class TestUtil {
  public static readonly ANDROID_KEY_PLACEHOLDER = "CODE_PUSH_ANDROID_DEPLOYMENT_KEY";
  public static readonly IOS_KEY_PLACEHOLDER = "CODE_PUSH_IOS_DEPLOYMENT_KEY";
  public static readonly SERVER_URL_PLACEHOLDER = "CODE_PUSH_SERVER_URL";
  public static readonly INDEX_JS_PLACEHOLDER = "CODE_PUSH_INDEX_JS_PATH";
  public static readonly CODE_PUSH_APP_VERSION_PLACEHOLDER = "CODE_PUSH_APP_VERSION";
  public static readonly CODE_PUSH_TEST_APP_NAME_PLACEHOLDER = "CODE_PUSH_TEST_APP_NAME";
  public static readonly CODE_PUSH_APP_ID_PLACEHOLDER = "CODE_PUSH_TEST_APPLICATION_ID";
  public static readonly PLUGIN_VERSION_PLACEHOLDER = "CODE_PUSH_PLUGIN_VERSION";

  public static readMochaCommandLineOption(optionName: string, defaultValue?: string): string | undefined {
    let optionValue: string | undefined;

    for (let index = 0; index < process.argv.length; index += 1) {
      if (process.argv[index] === optionName) {
        optionValue = process.argv[index + 1];
        break;
      }
    }

    return optionValue ?? defaultValue;
  }

  public static readMochaCommandLineFlag(optionName: string): boolean {
    return process.argv.includes(optionName);
  }

  public static getProcessOutput(command: string, options: ProcessOutputOptions = {}): Promise<string> {
    const resolvedOptions: ProcessOutputOptions = {
      maxBuffer: 1024 * 1024 * 500,
      timeout: 10 * 60 * 1000,
      ...options,
    };

    if (!resolvedOptions.noLogCommand) {
      console.log(`Running command: ${command}`);
    }

    return new Promise<string>((resolve, reject) => {
      const execProcess = exec(command, resolvedOptions, (error, stdout) => {
        if (error) {
          if (!resolvedOptions.noLogStdErr) {
            console.error(String(error));
          }
          reject(error);
          return;
        }

        resolve(stdout.toString());
      });

      if (!resolvedOptions.noLogStdOut) {
        execProcess.stdout?.pipe(process.stdout);
      }

      if (!resolvedOptions.noLogStdErr) {
        execProcess.stderr?.pipe(process.stderr);
      }

      execProcess.on("error", (error) => {
        if (!resolvedOptions.noLogStdErr) {
          console.error(String(error));
        }
        reject(error);
      });
    });
  }

  public static getPluginName(): string {
    return TestUtil.readPackageMetadata().name;
  }

  public static getPluginVersion(): string {
    return TestUtil.readPackageMetadata().version;
  }

  public static replaceString(filePath: string, regex: string, replacement: string): void {
    console.log(`replacing "${regex}" with "${replacement}" in ${filePath}`);
    const source = fs.readFileSync(filePath, "utf8");
    const output = source.replace(new RegExp(regex, "g"), replacement);
    fs.writeFileSync(filePath, output, "utf8");
  }

  public static async copyFile(source: string, destination: string, overwrite: boolean): Promise<void> {
    if (overwrite && fs.existsSync(destination)) {
      fs.unlinkSync(destination);
    }

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    await fs.promises.copyFile(source, destination);
  }

  public static archiveFolder(
    sourceFolder: string,
    targetFolder: string,
    archivePath: string,
    isDiff: boolean,
  ): Promise<string> {
    console.log(`Creating an update archive at: ${archivePath}`);

    if (fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath);
    }

    return new Promise<string>((resolve, reject) => {
      const archive = archiver("zip", {});
      const writeStream = fs.createWriteStream(archivePath);

      writeStream.on("close", () => {
        resolve(archivePath);
      });

      archive.on("error", (error) => {
        reject(error);
      });

      if (isDiff) {
        archive.append('{"deletedFiles":[]}', { name: "hotcodepush.json" });
      }

      archive.directory(sourceFolder, targetFolder);
      archive.pipe(writeStream);
      void archive.finalize();
    });
  }

  public static resolveBooleanVariables(variable: string | undefined): boolean {
    return variable?.toLowerCase() === "true";
  }

  private static readPackageMetadata(): PackageMetadata {
    const packageFilePath = path.join(process.cwd(), "package.json");

    if (!fs.existsSync(packageFilePath)) {
      throw new Error(`package.json was not found in the current working directory: ${process.cwd()}`);
    }

    const packageFile = JSON.parse(fs.readFileSync(packageFilePath, "utf8")) as Partial<PackageMetadata>;

    if (!packageFile.name || !packageFile.version) {
      throw new Error(`package.json in ${process.cwd()} must include "name" and "version".`);
    }

    return {
      name: packageFile.name,
      version: packageFile.version,
    };
  }
}
