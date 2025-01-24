import { findModuleChild, Module } from "@decky/ui";

const findModule = (property: string) => {
  return findModuleChild((m: Module) => {
    if (typeof m !== "object") return undefined;
    for (let prop in m) {
      try {
        if (m[prop][property]) {
          return m[prop];
        }
      } catch (e) {
        return undefined;
      }
    }
  });
}

const SleepParent = findModule("InitiateSleep")
export const NavSoundMap = findModule("ToastMisc")

export class SteamUtils {
  static async suspend() {
    SleepParent.OnSuspendRequest();
  }
}