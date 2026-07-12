import { mergeDeep } from "../../merge";
import { en as base } from "./bundle";
import { adminExt } from "./adminExt";
import { legalExt } from "./legalExt";
import { superadminExt } from "./superadminExt";
import { employeeExt } from "./employeeExt";

export const en = mergeDeep(base, adminExt, legalExt, superadminExt, employeeExt);
