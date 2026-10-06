// Status pills shown next to an account name in the Chart of Accounts:
// System, Inactive, Header (has child accounts) and the manual-entry state.
// Presentation only — every flag comes from data the page already loaded.

import { Tooltip } from "antd";
import { Pill } from "../../ui/PageKit";

export function AccountFlags({ isSystem, isActive, isHeader, allowManualEntry }: {
  isSystem?: boolean;
  isActive: boolean;
  isHeader: boolean;
  /** Undefined when the source row doesn't carry the flag (hierarchy nodes). */
  allowManualEntry?: boolean;
}) {
  return (
    <>
      {isSystem && <Pill tone="blue">System</Pill>}
      {!isActive && <Pill tone="red" dot>Inactive</Pill>}
      {isHeader && (
        <Tooltip title="Has child accounts — its Rollup includes every descendant">
          <span className="inline-flex"><Pill tone="violet">Header</Pill></span>
        </Tooltip>
      )}
      {isHeader && allowManualEntry === true && (
        <Tooltip title="Header account that still accepts manual entries — postings should go to a leaf account">
          <span className="inline-flex"><Pill tone="amber" dot>Manual entry on</Pill></span>
        </Tooltip>
      )}
      {!isHeader && allowManualEntry === false && (
        <Tooltip title="Manual journal entries are not allowed on this account">
          <span className="inline-flex"><Pill tone="gray" dot>Locked</Pill></span>
        </Tooltip>
      )}
    </>
  );
}
