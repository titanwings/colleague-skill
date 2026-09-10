import { BUILTIN_HOSTS } from "@distilly/protocol";

import { createCapabilityBinding } from "../capability-fixture.js";
import type { HostCapabilityBinding, HostCapabilityBindingOptions } from "../protocol.js";

/**
 * Creates the DeepSeek Harness capability binding around a trusted preflight provider.
 *
 * @param options - Provider and exact release tuple.
 * @returns DeepSeek Harness capability binding.
 */
export const createDshCapabilityBinding = (
  options: HostCapabilityBindingOptions,
): HostCapabilityBinding => createCapabilityBinding(BUILTIN_HOSTS.dsh, options);
