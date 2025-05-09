import { MockPostMessageStream } from '@metamask/snaps-utils/test-utils';
import { describe, expect, it } from 'vitest';

import { ProxySnapExecutor } from './ProxySnapExecutor';

const MOCK_JOB_ID = 'job-id';
const IFRAME_URL = 'http://localhost:63316/iframe/executor/index.html';

/**
 * Write a message to the stream, wrapped with the job ID and frame URL.
 *
 * @param stream - The stream to write to.
 * @param message - The message to write.
 */
function writeMessage(
  stream: MockPostMessageStream,
  message: Record<string, unknown>,
) {
  stream.write({
    jobId: MOCK_JOB_ID,
    data: message,
  });
}

/**
 * Write a termination message to the stream.
 *
 * @param stream - The stream to write to.
 * @returns A promise that resolves after 1 millisecond.
 */
async function terminateJob(stream: MockPostMessageStream) {
  writeMessage(stream, {
    jsonrpc: '2.0',
    id: 2,
    method: 'terminateJob',
  });

  return await new Promise((resolve) => setTimeout(resolve, 1));
}

/**
 * Wait for a response from the stream.
 *
 * @param stream - The stream to wait for a response on.
 * @returns The raw JSON-RPC response object.
 */
async function getResponse(
  stream: MockPostMessageStream,
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    stream.once('response', (data) => {
      resolve(data);
    });
  });
}

describe('ProxySnapExecutor', () => {
  it('forwards messages to the iframe', async () => {
    const mockStream = new MockPostMessageStream();

    ProxySnapExecutor.initialize(mockStream, IFRAME_URL);

    writeMessage(mockStream, {
      name: 'command',
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      },
    });

    expect(await getResponse(mockStream)).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    expect(document.getElementById(MOCK_JOB_ID)).toBeDefined();

    await terminateJob(mockStream);
  });

  it('terminates the iframe', async () => {
    const mockStream = new MockPostMessageStream();

    const executor = ProxySnapExecutor.initialize(mockStream, IFRAME_URL);

    // Send ping to ensure that the iframe is created.
    writeMessage(mockStream, {
      name: 'command',
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      },
    });

    // Wait for the response, so that we know the iframe is created.
    await getResponse(mockStream);
    await terminateJob(mockStream);

    expect(executor.jobs[MOCK_JOB_ID]).toBeUndefined();
    expect(document.getElementById(MOCK_JOB_ID)).toBeNull();
  });
});
