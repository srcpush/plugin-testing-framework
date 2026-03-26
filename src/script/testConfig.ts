import os from "node:os";
import path from "node:path";

import { TestUtil } from "./testUtil";

const packageRoot = path.resolve(__dirname, "..", "..");
const pluginRoot = process.cwd();

const DEFAULT_TEST_RUN_DIRECTORY = path.join(os.tmpdir(), TestUtil.getPluginName(), "test-run");
const DEFAULT_UPDATES_DIRECTORY = path.join(os.tmpdir(), TestUtil.getPluginName(), "updates");
const DEFAULT_TEMPLATE_PATH = path.join(packageRoot, "test", "template");
const DEFAULT_PLUGIN_TGZ_NAME =
  `${TestUtil.getPluginName().replace("@", "").replace("/", "-")}-${TestUtil.getPluginVersion()}.tgz`;

const SETUP_FLAG_NAME = "--setup";
const NPM_PLUGIN_PATH = TestUtil.getPluginName();

export const TestAppName = "TestCodePush";
export const TestNamespace = "com.testcodepush";
export const AcquisitionSDKPluginName = "code-push";
export const templatePath = process.env.TEST_TEMPLATE_PATH ?? DEFAULT_TEMPLATE_PATH;
export const thisPluginPath = process.env.PLUGIN_PATH ?? pluginRoot;
export const thisPluginInstallString = TestUtil.resolveBooleanVariables(process.env.NPM)
  ? `npm install ${NPM_PLUGIN_PATH}`
  : `npm pack ${thisPluginPath} && npm install ${DEFAULT_PLUGIN_TGZ_NAME} && npm link`;
export const testRunDirectory = process.env.RUN_DIR ?? DEFAULT_TEST_RUN_DIRECTORY;
export const updatesDirectory = process.env.UPDATE_DIR ?? DEFAULT_UPDATES_DIRECTORY;
export const onlyRunCoreTests = TestUtil.resolveBooleanVariables(process.env.CORE);
export const shouldSetup = TestUtil.readMochaCommandLineFlag(SETUP_FLAG_NAME);
export const restartEmulators = TestUtil.resolveBooleanVariables(process.env.CLEAN);
export const isOldArchitecture = TestUtil.resolveBooleanVariables(process.env.IS_OLD_ARCHITECTURE);
