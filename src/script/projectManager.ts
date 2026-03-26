import type { IPlatform } from "./platform";
import * as TestConfig from "./testConfig";

export class ProjectManager {
  public static readonly DEFAULT_APP_VERSION = "Store version";

  private static readonly NOT_IMPLEMENTED_ERROR_MSG =
    "This method is unimplemented. Extend ProjectManager and override it in your plugin repo.";

  public getPluginName(): string {
    throw new Error(ProjectManager.NOT_IMPLEMENTED_ERROR_MSG);
  }

  public setupProject(
    projectDirectory: string,
    templatePath: string,
    appName: string,
    appNamespace: string,
    version = ProjectManager.DEFAULT_APP_VERSION,
  ): Promise<void> {
    void projectDirectory;
    void templatePath;
    void appName;
    void appNamespace;
    void version;
    throw new Error(ProjectManager.NOT_IMPLEMENTED_ERROR_MSG);
  }

  public setupScenario(
    projectDirectory: string,
    appId: string,
    templatePath: string,
    jsPath: string,
    targetPlatform: IPlatform,
    version = ProjectManager.DEFAULT_APP_VERSION,
  ): Promise<void> {
    void projectDirectory;
    void appId;
    void templatePath;
    void jsPath;
    void targetPlatform;
    void version;
    throw new Error(ProjectManager.NOT_IMPLEMENTED_ERROR_MSG);
  }

  public createUpdateArchive(
    projectDirectory: string,
    targetPlatform: IPlatform,
    isDiff = false,
  ): Promise<string> {
    void projectDirectory;
    void targetPlatform;
    void isDiff;
    throw new Error(ProjectManager.NOT_IMPLEMENTED_ERROR_MSG);
  }

  public preparePlatform(projectDirectory: string, targetPlatform: IPlatform): Promise<void> {
    void projectDirectory;
    void targetPlatform;
    throw new Error(ProjectManager.NOT_IMPLEMENTED_ERROR_MSG);
  }

  public cleanupAfterPlatform(projectDirectory: string, targetPlatform: IPlatform): Promise<void> {
    void projectDirectory;
    void targetPlatform;
    throw new Error(ProjectManager.NOT_IMPLEMENTED_ERROR_MSG);
  }

  public runApplication(projectDirectory: string, targetPlatform: IPlatform): Promise<void> {
    void projectDirectory;
    void targetPlatform;
    throw new Error(ProjectManager.NOT_IMPLEMENTED_ERROR_MSG);
  }
}

export function setupTestRunScenario(
  projectManager: ProjectManager,
  targetPlatform: IPlatform,
  scenarioJsPath: string,
  version?: string,
): Promise<void> {
  return projectManager.setupScenario(
    TestConfig.testRunDirectory,
    TestConfig.TestNamespace,
    TestConfig.templatePath,
    scenarioJsPath,
    targetPlatform,
    version,
  );
}

export async function setupUpdateScenario(
  projectManager: ProjectManager,
  targetPlatform: IPlatform,
  scenarioJsPath: string,
  version: string,
): Promise<string> {
  await projectManager.setupScenario(
    TestConfig.updatesDirectory,
    TestConfig.TestNamespace,
    TestConfig.templatePath,
    scenarioJsPath,
    targetPlatform,
    version,
  );

  return projectManager.createUpdateArchive(TestConfig.updatesDirectory, targetPlatform);
}
