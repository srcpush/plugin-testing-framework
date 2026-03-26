import type { IPlatform } from "./platform";
import type { ProjectManager } from "./projectManager";
import * as ServerUtil from "./serverUtil";
import * as TestConfig from "./testConfig";

export type DoneCallback = (error?: unknown) => void;

export interface ITestBuilderContextDefintion {
  (description: string, spec: () => void, scenarioPath?: string): void;
  only(description: string, spec: () => void, scenarioPath?: string): void;
  skip(description: string, spec: () => void, scenarioPath?: string): void;
}

export interface ITestBuilderTestDefinition {
  (expectation: string, isCoreTest: boolean, assertion: (done: DoneCallback) => void): void;
  only(expectation: string, isCoreTest: boolean, assertion: (done: DoneCallback) => void): void;
  skip(expectation: string, isCoreTest: boolean, assertion: (done: DoneCallback) => void): void;
}

type DescribeLike = (description: string, spec: () => void) => unknown;
type ItLike = (expectation: string, assertion: (this: Mocha.Context, done: DoneCallback) => void) => unknown;

export class TestBuilder {
  public static readonly describe = getDescribe();
  public static readonly it = getIt();
}

export class TestContext {
  public static projectManager: ProjectManager | undefined;
  public static targetPlatform: IPlatform | undefined;
}

function describeInternal(
  describeFunction: DescribeLike,
  description: string,
  spec: () => void,
  scenarioPath?: string,
): unknown {
  if (!TestContext.projectManager || !TestContext.targetPlatform) {
    throw new Error(
      "TestContext.projectManager or TestContext.targetPlatform are not defined. Call TestBuilder.describe only from initializeTests.",
    );
  }

  return describeFunction(description, () => {
    afterEach(() => {
      console.log("Cleaning up!");
      ServerUtil.resetServerState();
    });

    beforeEach(async () => {
      await TestContext.targetPlatform?.getEmulatorManager().prepareEmulatorForTest(TestConfig.TestNamespace).catch(
        () => undefined,
      );
    });

    if (scenarioPath) {
      before(async () => {
        await TestContext.projectManager?.setupScenario(
          TestConfig.testRunDirectory,
          TestConfig.TestNamespace,
          TestConfig.templatePath,
          scenarioPath,
          TestContext.targetPlatform as IPlatform,
        );
      });
    }

    spec();
  });
}

function getDescribe(): ITestBuilderContextDefintion {
  const describer = ((description: string, spec: () => void, scenarioPath?: string) => {
    describeInternal(describe as DescribeLike, description, spec, scenarioPath);
  }) as ITestBuilderContextDefintion;

  describer.only = (description: string, spec: () => void, scenarioPath?: string) => {
    describeInternal(describe.only as DescribeLike, description, spec, scenarioPath);
  };

  describer.skip = (description: string, spec: () => void, scenarioPath?: string) => {
    describeInternal(describe.skip as DescribeLike, description, spec, scenarioPath);
  };

  return describer;
}

function itInternal(
  itFunction: ItLike,
  expectation: string,
  isCoreTest: boolean,
  assertion: (done: DoneCallback) => void,
): unknown {
  if (TestConfig.onlyRunCoreTests && !isCoreTest) {
    return undefined;
  }

  const assertionWithTimeout = function (this: Mocha.Context, done: DoneCallback): void {
    this.timeout(10 * 2 * 60 * 1000);
    assertion(done);
  };

  return itFunction(expectation, assertionWithTimeout);
}

function getIt(): ITestBuilderTestDefinition {
  const testFunction = ((expectation: string, isCoreTest: boolean, assertion: (done: DoneCallback) => void) => {
    itInternal(it as ItLike, expectation, isCoreTest, assertion);
  }) as ITestBuilderTestDefinition;

  testFunction.only = (expectation: string, isCoreTest: boolean, assertion: (done: DoneCallback) => void) => {
    itInternal(it.only as ItLike, expectation, isCoreTest, assertion);
  };

  testFunction.skip = (expectation: string, isCoreTest: boolean, assertion: (done: DoneCallback) => void) => {
    itInternal(it.skip as ItLike, expectation, isCoreTest, assertion);
  };

  return testFunction;
}
