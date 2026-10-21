/** Size in memory of NSMBUDX's main NSO. subsdk0 is loaded right after it. */
export const NSMBUDX_NSO_MEMORY_SIZE = 0x00CD1000;
/** Address where the main NSO starts being loaded. */
export const NSMBUDX_NSO_ADDR_START = 0x00004000;
/** Size of an NSO file header; converts in-memory addresses to file offsets for IPS patches. */
export const NSO_HEADER_SIZE = 0x100;

/** Address where subsdk0 is loaded (right after the main NSO). */
export const NSMBUDX_SUBSDK_ADDR = NSMBUDX_NSO_ADDR_START +
    NSMBUDX_NSO_MEMORY_SIZE;

/** Build ID of the supported main NSO; Atmosphère uses it as the .ips file name. */
export const NSMBUDX_BUILD_ID = "AEE6DCCC06D9C05B42061E2019123A61";
/** NSMBUDX's title ID. */
export const NSMBUDX_TITLE_ID = "0100EA80032EA000";

// Atmosphère paths, relative to the output folder.

/** Folder where subsdk0 is placed. */
export const NSMBUDX_EXEFS_PATH =
    `./atmosphere/contents/${NSMBUDX_TITLE_ID}/exefs`;
/** Folder where the .ips patch is placed. */
export const NSMBUDX_EXEFS_PATCHES_PATH =
    `./atmosphere/exefs_patches/${NSMBUDX_TITLE_ID}`;
/** Full path of the .ips patch. */
export const NSMBUDX_IPS_PATH =
    `${NSMBUDX_EXEFS_PATCHES_PATH}/${NSMBUDX_BUILD_ID}.ips`;
/** Full path of subsdk0. */
export const NSMBUDX_SUBSDK0_PATH = `${NSMBUDX_EXEFS_PATH}/subsdk0`;
