import { bytesToHex } from 'micro-stacks/common';
import type { Json } from 'micro-stacks/crypto';
import {
  TokenSigner,
  getPublicKey,
  getRandomBytes,
  privateKeyToBase58Address,
} from 'micro-stacks/crypto';
import type {
  GaiaAuthScope,
  GaiaHubConfig,
  GenerateGaiaHubConfigOptions,
  HubInfo,
  ScopedGaiaTokenOptions,
} from 'micro-stacks/storage';
import { makeScopedGaiaAuthToken } from 'micro-stacks/storage';
import { hmacSha256 } from 'micro-stacks/crypto-hmac-sha';
import { utils } from 'noble-secp256k1';

utils.hmacSha256Sync = hmacSha256;

export const DEFAULT_PAYLOAD: HubInfo = {
  challenge_text: '["gaiahub","0","storage2.hiro.so","blockstack_storage_please_sign"]',
  latest_auth_version: 'v1',
  max_file_upload_size_megabytes: 20,
  read_url_prefix: 'https://gaia.hiro.so/hub/',
};

/**
 * Generates a gaia hub config to share with someone so they can edit a file
 */
export async function generateGaiaHubConfigSync(
  options: GenerateGaiaHubConfigOptions
): Promise<GaiaHubConfig> {
  const { gaiaHubUrl, privateKey, associationToken, scopes } = options;
  const hubInfo = DEFAULT_PAYLOAD;

  const { read_url_prefix: url_prefix, max_file_upload_size_megabytes } = hubInfo;

  const token = await makeScopedGaiaAuthToken({
    hubInfo,
    privateKey,
    gaiaHubUrl,
    associationToken,
    scopes,
  });

  const address = privateKeyToBase58Address(privateKey);

  return {
    address,
    url_prefix,
    token,
    server: gaiaHubUrl,
    max_file_upload_size_megabytes: max_file_upload_size_megabytes ?? 20,
  };
}

export function makeScopedGaiaAuthTokenSync(options: ScopedGaiaTokenOptions): string {
  const payload = makeScopedGaiaAuthTokenPayload(options);
  const signer = new TokenSigner('ES256K', options.privateKey);
  const token = signer.signSync(payload);
  return `v1:${token}`;
}

function transformScopePath(scopes?: GaiaAuthScope[]) {
  return scopes?.map(scope => ({ ...scope, domain: scope.path })) ?? null;
}

export function makeScopedGaiaAuthTokenPayload(options: ScopedGaiaTokenOptions): Json {
  const { hubInfo, privateKey, gaiaHubUrl, associationToken = null, scopes } = options;
  const { challenge_text: gaiaChallenge } = hubInfo;
  const iss = bytesToHex(getPublicKey(privateKey, true));

  const salt = getRandomBytes(16).toString();
  const payload: Json = {
    gaiaChallenge,
    hubUrl: gaiaHubUrl,
    iss,
    salt,
    associationToken,
    scopes: transformScopePath(scopes),
  };
  return payload;
}
