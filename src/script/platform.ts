import { TestUtil } from "./testUtil";

export interface IPlatform {
  getName(): string;
  getCommandLineFlagName(): string;
  getServerUrl(): string;
  getEmulatorManager(): IEmulatorManager;
  getDefaultDeploymentKey(): string;
}

export interface IEmulatorManager {
  getTargetEmulator(): Promise<string>;
  bootEmulator(restartEmulators: boolean): Promise<void>;
  launchInstalledApplication(appId: string): Promise<void>;
  endRunningApplication(appId: string): Promise<void>;
  restartApplication(appId: string): Promise<void>;
  resumeApplication(appId: string, delayBeforeResumingMs?: number): Promise<void>;
  prepareEmulatorForTest(appId: string): Promise<void>;
  uninstallApplication(appId: string): Promise<void>;
}

const emulatorMaxReadyAttempts = 50;
const emulatorReadyCheckDelayMs = 5_000;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

async function bootEmulatorInternal(
  platformName: string,
  restartEmulators: boolean,
  targetEmulator: string,
  checkEmulator: (target: string) => Promise<unknown>,
  startEmulator: (target: string) => Promise<unknown>,
  killEmulator: () => Promise<unknown>,
): Promise<void> {
  console.log(`Setting up ${platformName} emulator.`);

  const onEmulatorReady = (): void => {
    console.log(`${platformName} emulator is ready!`);
  };

  const checkEmulatorReady = async (): Promise<void> => {
    console.log(`Checking if ${platformName} emulator is ready yet...`);

    try {
      await checkEmulator(targetEmulator);
    } catch (error) {
      console.info(error);
      console.log(`${platformName} emulator is not ready yet!`);
      throw error;
    }
  };

  const checkEmulatorReadyLooper = async (): Promise<void> => {
    for (let emulatorReadyAttempts = 1; emulatorReadyAttempts <= emulatorMaxReadyAttempts; emulatorReadyAttempts += 1) {
      await delay(emulatorReadyCheckDelayMs);

      try {
        await checkEmulatorReady();
        onEmulatorReady();
        return;
      } catch {
        // Keep polling until the emulator is ready or the max attempt count is exceeded.
      }
    }

    console.log(`${platformName} emulator is not ready after ${emulatorMaxReadyAttempts} attempts, abort.`);
    throw new Error(`${platformName} emulator failed to boot.`);
  };

  const startEmulatorAndLoop = async (): Promise<void> => {
    console.log(`Booting ${platformName} emulator named ${targetEmulator}.`);

    try {
      await startEmulator(targetEmulator);
    } catch (error) {
      console.log(error);
      throw error;
    }

    await checkEmulatorReadyLooper();
  };

  if (restartEmulators) {
    console.log(`Killing ${platformName} emulator.`);
    await killEmulator().catch(() => undefined);
    await startEmulatorAndLoop();
    return;
  }

  try {
    await checkEmulatorReady();
    onEmulatorReady();
  } catch {
    await startEmulatorAndLoop();
  }
}

export class Android implements IPlatform {
  private static readonly DEFAULT_ANDROID_SERVER_URL = "http://10.0.2.2:3001";

  private serverUrl?: string;

  public constructor(private readonly emulatorManager: IEmulatorManager) {}

  public getName(): string {
    return "android";
  }

  public getCommandLineFlagName(): string {
    return "--android";
  }

  public getServerUrl(): string {
    if (!this.serverUrl) {
      this.serverUrl = process.env.ANDROID_SERVER ?? Android.DEFAULT_ANDROID_SERVER_URL;
    }

    return this.serverUrl;
  }

  public getEmulatorManager(): IEmulatorManager {
    return this.emulatorManager;
  }

  public getDefaultDeploymentKey(): string {
    return "mock-android-deployment-key";
  }
}

export class IOS implements IPlatform {
  private static readonly DEFAULT_IOS_SERVER_URL = "http://127.0.0.1:3000";

  private serverUrl?: string;

  public constructor(private readonly emulatorManager: IEmulatorManager) {}

  public getName(): string {
    return "ios";
  }

  public getCommandLineFlagName(): string {
    return "--ios";
  }

  public getServerUrl(): string {
    if (!this.serverUrl) {
      this.serverUrl = process.env.IOS_SERVER ?? IOS.DEFAULT_IOS_SERVER_URL;
    }

    return this.serverUrl;
  }

  public getEmulatorManager(): IEmulatorManager {
    return this.emulatorManager;
  }

  public getDefaultDeploymentKey(): string {
    return "mock-ios-deployment-key";
  }
}

export class AndroidEmulatorManager implements IEmulatorManager {
  private targetEmulator?: string;

  public async getTargetEmulator(): Promise<string> {
    if (this.targetEmulator) {
      return this.targetEmulator;
    }

    const targetAndroidEmulator = process.env.ANDROID_EMU;

    if (targetAndroidEmulator) {
      this.targetEmulator = targetAndroidEmulator;
    } else {
      const devices = await TestUtil.getProcessOutput("emulator -list-avds", {
        noLogCommand: true,
        noLogStdOut: true,
        noLogStdErr: true,
      });
      const listOfDevices = devices
        .trim()
        .split("\n")
        .map((device) => device.trim())
        .filter(Boolean);
      const lastDevice = listOfDevices[listOfDevices.length - 1];

      if (!lastDevice) {
        throw new Error("No Android emulator was found. Set ANDROID_EMU or install an AVD.");
      }

      this.targetEmulator = lastDevice;
    }

    console.log(`Using Android simulator named ${this.targetEmulator}`);
    return this.targetEmulator;
  }

  public async bootEmulator(restartEmulators: boolean): Promise<void> {
    const checkAndroidEmulator = async (): Promise<void> => {
      await TestUtil.getProcessOutput("adb shell pm list packages", {
        noLogCommand: true,
        noLogStdOut: true,
        noLogStdErr: true,
      });
    };

    const startAndroidEmulator = async (androidEmulatorName: string): Promise<void> => {
      const androidEmulatorCommand = `emulator @${androidEmulatorName}`;
      const osSpecificCommand =
        process.platform === "darwin" ? `${androidEmulatorCommand} &` : `START /B ${androidEmulatorCommand}`;

      await TestUtil.getProcessOutput(osSpecificCommand, { noLogStdErr: true, timeout: 5_000 });
    };

    const killAndroidEmulator = async (): Promise<void> => {
      await TestUtil.getProcessOutput("adb emu kill");
    };

    const targetEmulator = await this.getTargetEmulator();

    await bootEmulatorInternal(
      "Android",
      restartEmulators,
      targetEmulator,
      checkAndroidEmulator,
      startAndroidEmulator,
      killAndroidEmulator,
    );
  }

  public async launchInstalledApplication(appId: string): Promise<void> {
    await TestUtil.getProcessOutput(`adb shell monkey -p ${appId} -c android.intent.category.LAUNCHER 1`);
  }

  public async endRunningApplication(appId: string): Promise<void> {
    await TestUtil.getProcessOutput(`adb shell am force-stop ${appId}`);
    await delay(10_000);
  }

  public async restartApplication(appId: string): Promise<void> {
    await this.endRunningApplication(appId);
    await delay(1_000);
    await this.launchInstalledApplication(appId);
  }

  public async resumeApplication(appId: string, delayBeforeResumingMs = 1_000): Promise<void> {
    await this.launchInstalledApplication("com.android.settings");
    console.log(`Waiting for ${delayBeforeResumingMs}ms before resuming the test application.`);
    await delay(delayBeforeResumingMs);
    await this.launchInstalledApplication(appId);
  }

  public async prepareEmulatorForTest(appId: string): Promise<void> {
    await this.endRunningApplication(appId);
    await commandWithCheckAppExistence("adb shell pm clear", appId);
  }

  public async uninstallApplication(appId: string): Promise<void> {
    await commandWithCheckAppExistence("adb uninstall", appId);
  }
}

export class IOSEmulatorManager implements IEmulatorManager {
  private targetEmulator?: string;

  public async getTargetEmulator(): Promise<string> {
    if (this.targetEmulator) {
      return this.targetEmulator;
    }

    const targetIOSEmulator = process.env.IOS_EMU;

    if (targetIOSEmulator) {
      this.targetEmulator = targetIOSEmulator;
    } else {
      const listOfDevicesWithDevicePairs = await TestUtil.getProcessOutput("xcrun simctl list", {
        noLogCommand: true,
        noLogStdOut: true,
        noLogStdErr: true,
      });

      const iOSSection = listOfDevicesWithDevicePairs.slice(
        listOfDevicesWithDevicePairs.indexOf("-- iOS"),
        listOfDevicesWithDevicePairs.indexOf("-- tvOS"),
      );
      const phoneDevice = /iPhone\ \S*\ ?.*?\(([0-9A-Z-]*)\)/;
      const match = phoneDevice.exec(iOSSection);

      if (!match?.[1]) {
        throw new Error("No iOS simulator was found. Set IOS_EMU or install a simulator runtime.");
      }

      this.targetEmulator = match[1];
    }

    console.log(`Using iOS simulator named ${this.targetEmulator}`);
    return this.targetEmulator;
  }

  public async bootEmulator(restartEmulators: boolean): Promise<void> {
    const checkIOSEmulator = async (iOSEmulatorId: string): Promise<void> => {
      const simUdid = await TestUtil.getProcessOutput("xcrun simctl getenv booted SIMULATOR_UDID", {
        noLogCommand: true,
        noLogStdOut: true,
        noLogStdErr: true,
      });

      if (simUdid.trim() !== iOSEmulatorId.trim()) {
        throw new Error("Waiting for device to boot");
      }
    };

    const startIOSEmulator = async (iOSEmulatorId: string): Promise<void> => {
      await TestUtil.getProcessOutput(`xcrun simctl boot ${iOSEmulatorId}`, { noLogStdErr: true }).catch(
        () => undefined,
      );
    };

    const killIOSEmulator = async (): Promise<void> => {
      await TestUtil.getProcessOutput("xcrun simctl shutdown all");
    };

    const targetEmulator = await this.getTargetEmulator();

    await bootEmulatorInternal(
      "iOS",
      restartEmulators,
      targetEmulator,
      checkIOSEmulator,
      startIOSEmulator,
      killIOSEmulator,
    );
  }

  public async launchInstalledApplication(appId: string): Promise<void> {
    await TestUtil.getProcessOutput(`xcrun simctl launch booted ${appId}`);
  }

  public async endRunningApplication(appId: string): Promise<void> {
    await TestUtil.getProcessOutput(`xcrun simctl terminate booted ${appId}`).catch(() => undefined);
  }

  public async restartApplication(appId: string): Promise<void> {
    await this.endRunningApplication(appId);
    await delay(1_000);
    await this.launchInstalledApplication(appId);
  }

  public async resumeApplication(appId: string, delayBeforeResumingMs = 1_000): Promise<void> {
    await this.launchInstalledApplication("com.apple.Preferences");
    console.log(`Waiting for ${delayBeforeResumingMs}ms before resuming the test application.`);
    await delay(delayBeforeResumingMs);
    await this.launchInstalledApplication(appId);
  }

  public async prepareEmulatorForTest(appId: string): Promise<void> {
    await this.endRunningApplication(appId);
  }

  public async uninstallApplication(appId: string): Promise<void> {
    await TestUtil.getProcessOutput(`xcrun simctl uninstall booted ${appId}`);
  }
}

async function commandWithCheckAppExistence(command: string, appId: string): Promise<void> {
  const output = await TestUtil.getProcessOutput("adb shell pm list packages", {
    noLogCommand: true,
    noLogStdOut: true,
    noLogStdErr: true,
  });
  const isAppInstalled = output.includes(appId);

  if (!isAppInstalled) {
    console.log(`Command "${command}" is skipped because the application has not yet been installed`);
    return;
  }

  await TestUtil.getProcessOutput(`${command} ${appId}`);
}
