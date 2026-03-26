# @srcpush/plugin-testing-framework

Testing framework for CodePush-compatible plugins with:

- Mocha helpers for integration suites
- Mock update server utilities
- Android and iOS emulator managers
- Scenario and update setup helpers for plugin repositories

## Installation

```bash
npm install --save-dev @srcpush/plugin-testing-framework mocha
```

## What this package expects

This framework is designed to run from the root of the plugin repository under test.

- `process.cwd()` should point to the plugin repository
- the plugin repository `package.json` should contain the plugin `name` and `version`
- by default, the test app template is loaded from the package itself at `test/template`
- you can override the template path with `TEST_TEMPLATE_PATH`

## Quick start

```ts
import {
  Platform,
  PluginTestingFramework,
  ProjectManager,
  TestBuilder,
} from "@srcpush/plugin-testing-framework";

class MyProjectManager extends ProjectManager {
  public getPluginName(): string {
    return "react-native";
  }

  public async setupProject(): Promise<void> {
    throw new Error("Implement setupProject for your plugin");
  }

  public async setupScenario(): Promise<void> {
    throw new Error("Implement setupScenario for your plugin");
  }

  public async createUpdateArchive(): Promise<string> {
    throw new Error("Implement createUpdateArchive for your plugin");
  }

  public async preparePlatform(): Promise<void> {
    throw new Error("Implement preparePlatform for your plugin");
  }

  public async cleanupAfterPlatform(): Promise<void> {
    throw new Error("Implement cleanupAfterPlatform for your plugin");
  }

  public async runApplication(): Promise<void> {
    throw new Error("Implement runApplication for your plugin");
  }
}

const projectManager = new MyProjectManager();
const supportedPlatforms = [
  new Platform.Android(new Platform.AndroidEmulatorManager()),
  new Platform.IOS(new Platform.IOSEmulatorManager()),
];

PluginTestingFramework.initializeTests(projectManager, supportedPlatforms, () => {
  TestBuilder.describe("basic flow", () => {
    TestBuilder.it("runs a core assertion", true, async (done) => {
      done();
    });
  });
});
```

## Runtime configuration

The framework reads these environment variables:

- `ANDROID_EMU`: Android emulator name
- `IOS_EMU`: iOS simulator identifier
- `ANDROID_SERVER`: Android mock server URL
- `IOS_SERVER`: iOS mock server URL
- `RUN_DIR`: directory used for the working test app
- `UPDATE_DIR`: directory used for update packages
- `PLUGIN_PATH`: override the plugin directory used for `npm pack`
- `TEST_TEMPLATE_PATH`: override the packaged test template
- `CORE=true`: only run core tests
- `CLEAN=true`: restart emulators before setup
- `NPM=true`: install the plugin from npm instead of `npm pack`
- `IS_OLD_ARCHITECTURE=true`: consumer-specific compatibility flag

## Development

```bash
npm install
npm run verify
```

## Release

This repository is configured to publish to npm from GitHub Actions.

Recommended setup:

1. Create the GitHub repository at `srcpush/plugin-testing-framework`.
2. In npm, configure a trusted publisher for this repository and the workflow file `.github/workflows/publish.yml`.
3. Publish a GitHub Release to trigger the npm workflow.

The package is published as `@srcpush/plugin-testing-framework` with public access.

## License

MIT
