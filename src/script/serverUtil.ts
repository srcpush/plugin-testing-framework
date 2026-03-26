import assert from "node:assert";
import type { Server } from "node:http";
import express, { type Request } from "express";

import type { IPlatform } from "./platform";

export type AppMessagePayload = {
  message: string;
  args?: unknown[];
};

export let server: Server | undefined;
export let updateResponse: CheckForUpdateResponseMock | undefined;
export let testMessageResponse: string | undefined;
export let testMessageCallback: ((requestBody: AppMessagePayload) => void) | undefined;
export let updateCheckCallback: ((request: Request) => void) | undefined;
export let updatePackagePath: string;

export function setupServer(targetPlatform: IPlatform): void {
  console.log(`Setting up server at ${targetPlatform.getServerUrl()}`);

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use((_, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "*");
    response.setHeader("Access-Control-Allow-Headers", "origin, content-type, accept, X-CodePush-SDK-Version");
    next();
  });

  app.get("/v0.1/public/codepush/update_check", (request, response) => {
    updateCheckCallback?.(request);
    response.send(updateResponse);
    console.log("Update check called from the app.");
    console.log(`Request: ${JSON.stringify(request.query)}`);
    console.log(`Response: ${JSON.stringify(updateResponse)}`);
  });

  app.get("/v0.1/public/codepush/report_status/download", (_, response) => {
    console.log("Application downloading the package.");
    response.download(updatePackagePath);
  });

  app.post("/reportTestMessage", (request, response) => {
    console.log("Application reported a test message.");
    console.log(`Body: ${JSON.stringify(request.body)}`);

    if (!testMessageResponse) {
      console.log("Sending OK");
      response.sendStatus(200);
    } else {
      console.log(`Sending body: ${testMessageResponse}`);
      response.status(200).send(testMessageResponse);
    }

    testMessageCallback?.(request.body as AppMessagePayload);
  });

  const serverPortMatch = /:([0-9]+)/.exec(targetPlatform.getServerUrl());

  if (!serverPortMatch?.[1]) {
    throw new Error(`Unable to determine a server port from URL: ${targetPlatform.getServerUrl()}`);
  }

  server = app.listen(Number(serverPortMatch[1]));
}

export function cleanupServer(): void {
  server?.close();
  server = undefined;
}

export function resetServerState(): void {
  updateResponse = undefined;
  testMessageResponse = undefined;
  testMessageCallback = undefined;
  updateCheckCallback = undefined;
}

export class CheckForUpdateResponseMock {
  public download_url = "";
  public is_available = false;
  public should_run_binary_version = false;
  public package_size = 0;
  public update_app_version = false;
  public target_binary_range = "";
  public is_disabled = false;
  public description = "";
  public label = "";
  public package_hash = "";
  public is_mandatory = false;
}

export class UpdateCheckRequestMock {
  public deploymentKey = "";
  public appVersion = "";
  public packageHash = "";
  public isCompanion = false;
}

export function createDefaultResponse(): CheckForUpdateResponseMock {
  return new CheckForUpdateResponseMock();
}

export function createUpdateResponse(
  mandatory = false,
  targetPlatform?: IPlatform,
  randomHash = true,
): CheckForUpdateResponseMock {
  const response = new CheckForUpdateResponseMock();
  response.is_available = true;
  response.target_binary_range = "1.0.0";
  response.download_url = "mock.url/v0.1/public/codepush/report_status/download";
  response.is_mandatory = mandatory;
  response.label = "mock-update";
  response.package_hash = "12345-67890";
  response.package_size = 12345;

  if (targetPlatform) {
    response.download_url = `${targetPlatform.getServerUrl()}/v0.1/public/codepush/report_status/download`;
  }

  if (randomHash) {
    response.package_hash = `randomHash-${Math.floor(Math.random() * 10_000)}`;
  }

  return response;
}

export function expectTestMessages(expectedMessages: Array<string | AppMessage>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let messageIndex = 0;
    let lastRequestBody: AppMessagePayload | null = null;

    testMessageCallback = (requestBody) => {
      try {
        console.log(`Message index: ${messageIndex}`);

        if (lastRequestBody !== null && areEqual(requestBody, lastRequestBody)) {
          return;
        }

        const expectedMessage = expectedMessages[messageIndex];

        if (typeof expectedMessage === "string") {
          assert.equal(requestBody.message, expectedMessage);
        } else {
          assert(areEqual(requestBody, expectedMessage));
        }

        lastRequestBody = requestBody;
        messageIndex += 1;

        if (messageIndex === expectedMessages.length) {
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    };
  });
}

export class TestMessage {
  public static readonly CHECK_UP_TO_DATE = "CHECK_UP_TO_DATE";
  public static readonly CHECK_UPDATE_AVAILABLE = "CHECK_UPDATE_AVAILABLE";
  public static readonly CHECK_ERROR = "CHECK_ERROR";
  public static readonly DOWNLOAD_SUCCEEDED = "DOWNLOAD_SUCCEEDED";
  public static readonly DOWNLOAD_ERROR = "DOWNLOAD_ERROR";
  public static readonly UPDATE_INSTALLED = "UPDATE_INSTALLED";
  public static readonly INSTALL_ERROR = "INSTALL_ERROR";
  public static readonly DEVICE_READY_AFTER_UPDATE = "DEVICE_READY_AFTER_UPDATE";
  public static readonly UPDATE_FAILED_PREVIOUSLY = "UPDATE_FAILED_PREVIOUSLY";
  public static readonly NOTIFY_APP_READY_SUCCESS = "NOTIFY_APP_READY_SUCCESS";
  public static readonly NOTIFY_APP_READY_FAILURE = "NOTIFY_APP_READY_FAILURE";
  public static readonly SKIPPED_NOTIFY_APPLICATION_READY = "SKIPPED_NOTIFY_APPLICATION_READY";
  public static readonly SYNC_STATUS = "SYNC_STATUS";
  public static readonly RESTART_SUCCEEDED = "RESTART_SUCCEEDED";
  public static readonly RESTART_FAILED = "RESTART_FAILED";
  public static readonly PENDING_PACKAGE = "PENDING_PACKAGE";
  public static readonly CURRENT_PACKAGE = "CURRENT_PACKAGE";
  public static readonly SYNC_UP_TO_DATE = 0;
  public static readonly SYNC_UPDATE_INSTALLED = 1;
  public static readonly SYNC_UPDATE_IGNORED = 2;
  public static readonly SYNC_ERROR = 3;
  public static readonly SYNC_IN_PROGRESS = 4;
  public static readonly SYNC_CHECKING_FOR_UPDATE = 5;
  public static readonly SYNC_AWAITING_USER_ACTION = 6;
  public static readonly SYNC_DOWNLOADING_PACKAGE = 7;
  public static readonly SYNC_INSTALLING_UPDATE = 8;
}

export class TestMessageResponse {
  public static readonly SKIP_NOTIFY_APPLICATION_READY = "SKIP_NOTIFY_APPLICATION_READY";
}

export class AppMessage {
  public constructor(
    public readonly message: string,
    public readonly args?: unknown[],
  ) {}

  public static fromString(message: string): AppMessage {
    return new AppMessage(message);
  }
}

export function areEqual(
  firstMessage: AppMessagePayload | AppMessage | null | undefined,
  secondMessage: AppMessagePayload | AppMessage | null | undefined,
): boolean {
  if (firstMessage === secondMessage) {
    return true;
  }

  if (!firstMessage || !secondMessage || firstMessage.message !== secondMessage.message) {
    return false;
  }

  if (firstMessage.args === secondMessage.args) {
    return true;
  }

  if (!firstMessage.args || !secondMessage.args || firstMessage.args.length !== secondMessage.args.length) {
    return false;
  }

  for (let index = 0; index < firstMessage.args.length; index += 1) {
    if (firstMessage.args[index] !== secondMessage.args[index]) {
      return false;
    }
  }

  return true;
}
