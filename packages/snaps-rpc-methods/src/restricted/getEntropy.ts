import type { CryptographicFunctions } from '@metamask/key-tree';
import type {
  PermissionSpecificationBuilder,
  RestrictedMethodOptions,
  ValidPermissionSpecification,
} from '@metamask/permission-controller';
import { PermissionType, SubjectType } from '@metamask/permission-controller';
import { rpcErrors } from '@metamask/rpc-errors';
import type { GetEntropyParams, GetEntropyResult } from '@metamask/snaps-sdk';
import { SIP_6_MAGIC_VALUE } from '@metamask/snaps-utils';
import type { Infer } from '@metamask/superstruct';
import { literal, object, optional, string } from '@metamask/superstruct';
import type { NonEmptyArray } from '@metamask/utils';
import { assertStruct } from '@metamask/utils';

import type { MethodHooksObject } from '../utils';
import { getValueFromEntropySource, deriveEntropyFromSeed } from '../utils';

const targetName = 'snap_getEntropy';

type GetEntropySpecificationBuilderOptions = {
  allowedCaveats?: Readonly<NonEmptyArray<string>> | null;
  methodHooks: GetEntropyHooks;
};

type GetEntropySpecification = ValidPermissionSpecification<{
  permissionType: PermissionType.RestrictedMethod;
  targetName: typeof targetName;
  methodImplementation: ReturnType<typeof getEntropyImplementation>;
  allowedCaveats: Readonly<NonEmptyArray<string>> | null;
}>;

export const GetEntropyArgsStruct = object({
  version: literal(1),
  salt: optional(string()),
  source: optional(string()),
});

/**
 * @property version - The version of the `snap_getEntropy` method. This must be
 * the numeric literal `1`.
 * @property salt - A string to use as the salt when deriving the entropy. If
 * omitted, the salt will be an empty string.
 */
export type GetEntropyArgs = Infer<typeof GetEntropyArgsStruct>;

const specificationBuilder: PermissionSpecificationBuilder<
  PermissionType.RestrictedMethod,
  GetEntropySpecificationBuilderOptions,
  GetEntropySpecification
> = ({
  allowedCaveats = null,
  methodHooks,
}: GetEntropySpecificationBuilderOptions) => {
  return {
    permissionType: PermissionType.RestrictedMethod,
    targetName,
    allowedCaveats,
    methodImplementation: getEntropyImplementation(methodHooks),
    subjectTypes: [SubjectType.Snap],
  };
};

const methodHooks: MethodHooksObject<GetEntropyHooks> = {
  getMnemonicSeed: true,
  getUnlockPromise: true,
  getClientCryptography: true,
};

export const getEntropyBuilder = Object.freeze({
  targetName,
  specificationBuilder,
  methodHooks,
} as const);

export type GetEntropyHooks = {
  /**
   * Get the mnemonic seed of the provided source. If no source is provided, the
   * mnemonic seed of the primary keyring will be returned.
   *
   * @param source - The optional ID of the source to get the mnemonic of.
   * @returns The mnemonic seed of the provided source, or the default source if no
   * source is provided.
   */
  getMnemonicSeed: (source?: string | undefined) => Promise<Uint8Array>;

  /**
   * Waits for the extension to be unlocked.
   *
   * @returns A promise that resolves once the extension is unlocked.
   */
  getUnlockPromise: (shouldShowUnlockRequest: boolean) => Promise<void>;

  /**
   * Get the cryptographic functions to use for the client. This may return an
   * empty object or `undefined` to fall back to the default cryptographic
   * functions.
   *
   * @returns The cryptographic functions to use for the client.
   */
  getClientCryptography: () => CryptographicFunctions | undefined;
};

/**
 * Builds the method implementation for `snap_getEntropy`. The implementation
 * is based on the reference implementation of
 * [SIP-6](https://metamask.github.io/SIPs/SIPS/sip-6).
 *
 * @param hooks - The RPC method hooks.
 * @param hooks.getMnemonicSeed - A function to retrieve the BIP-39 seed
 * of the user.
 * @param hooks.getUnlockPromise - The method to get a promise that resolves
 * once the extension is unlocked.
 * @param hooks.getClientCryptography - A function to retrieve the cryptographic
 * functions to use for the client.
 * @returns The method implementation.
 */
function getEntropyImplementation({
  getMnemonicSeed,
  getUnlockPromise,
  getClientCryptography,
}: GetEntropyHooks) {
  return async function getEntropy(
    options: RestrictedMethodOptions<GetEntropyParams>,
  ): Promise<GetEntropyResult> {
    const {
      params,
      context: { origin },
    } = options;

    assertStruct(
      params,
      GetEntropyArgsStruct,
      'Invalid "snap_getEntropy" parameters',
      rpcErrors.invalidParams,
    );

    await getUnlockPromise(true);
    const seed = await getValueFromEntropySource(
      getMnemonicSeed,
      params.source,
    );

    return deriveEntropyFromSeed({
      input: origin,
      salt: params.salt,
      seed,
      magic: SIP_6_MAGIC_VALUE,
      cryptographicFunctions: getClientCryptography(),
    });
  };
}
