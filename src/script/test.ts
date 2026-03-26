import type { IPlatform } from "./platform";
import type { ProjectManager } from "./projectManager";
import * as ServerUtil from "./serverUtil";
import * as TestConfig from "./testConfig";
import { TestContext } from "./testBuilder";
import { TestUtil } from "./testUtil";

export function initializeTests(
  projectManager: ProjectManager,
  supportedTargetPlatforms: IPlatform[],
  describeTests: (projectManager: ProjectManager, targetPlatform: IPlatform) => void,
): void {
  const targetPlatforms: IPlatform[] = [];

  supportedTargetPlatforms.forEach((supportedPlatform) => {
    if (TestUtil.readMochaCommandLineFlag(supportedPlatform.getCommandLineFlagName())) {
      targetPlatforms.push(supportedPlatform);
    }
  });

  console.log(`Initializing tests for ${TestUtil.getPluginName()}`);
  console.log(`${TestConfig.TestAppName}\n${TestConfig.TestNamespace}`);
  console.log(`Testing ${TestConfig.thisPluginPath}.`);
  targetPlatforms.forEach((platform) => {
    console.log(`On ${platform.getName()}`);
  });
  console.log(`test run directory = ${TestConfig.testRunDirectory}`);
  console.log(`updates directory = ${TestConfig.updatesDirectory}`);

  if (TestConfig.onlyRunCoreTests) {
    console.log("--only running core tests--");
  }

  if (TestConfig.shouldSetup) {
    console.log("--setting up--");
  }

  if (TestConfig.restartEmulators) {
    console.log("--restarting emulators--");
  }

  function setupTests(): void {
    it("sets up tests correctly", async function () {
      const platformSetup = targetPlatforms.map((platform) =>
        platform.getEmulatorManager().bootEmulator(TestConfig.restartEmulators),
      );

      console.log("Building test project.");
      await Promise.all(platformSetup);
      await createTestProject(TestConfig.testRunDirectory);
      console.log("Building update project.");
      await createTestProject(TestConfig.updatesDirectory);
    });
  }

  function createTestProject(directory: string): Promise<void> {
    return projectManager.setupProject(
      directory,
      TestConfig.templatePath,
      TestConfig.TestAppName,
      TestConfig.TestNamespace,
    );
  }

  function createAndRunTests(targetPlatform: IPlatform): void {
    describe("CodePush", function () {
      before(async function () {
        ServerUtil.setupServer(targetPlatform);
        await targetPlatform.getEmulatorManager().uninstallApplication(TestConfig.TestNamespace);
        await projectManager.preparePlatform(TestConfig.testRunDirectory, targetPlatform);
        await projectManager.preparePlatform(TestConfig.updatesDirectory, targetPlatform);
      });

      after(async function () {
        ServerUtil.cleanupServer();
        await projectManager.cleanupAfterPlatform(TestConfig.testRunDirectory, targetPlatform);
        await projectManager.cleanupAfterPlatform(TestConfig.updatesDirectory, targetPlatform);
      });

      TestContext.projectManager = projectManager;
      TestContext.targetPlatform = targetPlatform;
      describeTests(projectManager, targetPlatform);
    });
  }

  describe(`CodePush ${projectManager.getPluginName()} Plugin`, function () {
    this.timeout(100 * 60 * 1000);

    if (TestConfig.shouldSetup) {
      describe("Setting Up For Tests", function () {
        setupTests();
      });
      return;
    }

    targetPlatforms.forEach((platform) => {
      const prefix = `${TestConfig.onlyRunCoreTests ? "Core Tests" : "Tests"} ${TestConfig.thisPluginPath} on `;
      describe(`${prefix}${platform.getName()}`, function () {
        createAndRunTests(platform);
      });
    });
  });
}
