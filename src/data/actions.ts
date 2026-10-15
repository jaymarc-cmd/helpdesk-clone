import type { CatalogAction, ToolId } from '../types';

/**
 * Every action is available on every ticket, just like a real service desk console.
 * Scenarios decide which actions are required, helpful or harmful, and may override the result text.
 */
export const ACTIONS: CatalogAction[] = [
  // ----- Directory & mailbox -----
  {
    id: 'unlock_account',
    tool: 'directory',
    label: 'Unlock account',
    description: 'Clears the lockout flag on the user account.',
    sensitive: true,
    result: 'Account unlocked. Failed logon counter reset to 0.',
  },
  {
    id: 'reset_password',
    tool: 'directory',
    label: 'Reset password',
    description: 'Sets a temporary password and forces a change at next sign-in.',
    sensitive: true,
    result: 'Temporary password generated and delivered to the user via the verified channel. User must change it at next sign-in.',
  },
  {
    id: 'enable_account',
    tool: 'directory',
    label: 'Enable account',
    description: 'Re-enables a disabled user account.',
    sensitive: true,
    result: 'Account enabled.',
  },
  {
    id: 'reset_mfa',
    tool: 'directory',
    label: 'Reset MFA registration',
    description: 'Removes registered MFA methods so the user can enroll a new device.',
    sensitive: true,
    result: 'MFA methods cleared. User will be prompted to re-register at next sign-in.',
  },
  {
    id: 'revoke_sessions',
    tool: 'directory',
    label: 'Revoke all sign-in sessions',
    description: 'Signs the user out of every device and invalidates refresh tokens.',
    result: 'All active sessions revoked. User will need to sign in again on every device.',
  },
  {
    id: 'add_group',
    tool: 'directory',
    label: 'Add to requested security group',
    description: 'Adds the user to the group named in the request.',
    result: 'Group membership updated.',
  },
  {
    id: 'enable_archive',
    tool: 'directory',
    label: 'Enable online archive',
    description: 'Turns on the mailbox online archive and applies the default archive policy.',
    result: 'Online archive enabled. The archive policy will begin moving older items shortly.',
  },
  {
    id: 'raise_quota',
    tool: 'directory',
    label: 'Raise mailbox quota',
    description: 'Increases the storage limit on the mailbox (requires Messaging team approval).',
    result: 'Quota change submitted without an approval reference.',
  },

  // ----- Endpoint management -----
  {
    id: 'remote_restart',
    tool: 'endpoint',
    label: 'Remote restart device',
    description: 'Sends a forced restart to the device. Unsaved work is lost.',
    result: 'Restart command sent. The device came back online about 2 minutes later.',
  },
  {
    id: 'restart_spooler',
    tool: 'endpoint',
    label: 'Restart Print Spooler service',
    description: 'Restarts the Windows print spooler on the device.',
    result: 'Print Spooler service restarted.',
  },
  {
    id: 'clear_print_queue',
    tool: 'endpoint',
    label: 'Clear print queue',
    description: 'Deletes all pending jobs for the user on their default printer.',
    result: 'Print queue cleared.',
  },
  {
    id: 'flush_dns',
    tool: 'endpoint',
    label: 'Flush DNS cache',
    description: 'Clears the resolver cache on the device (same as ipconfig /flushdns).',
    result: 'DNS resolver cache flushed.',
  },
  {
    id: 'disk_cleanup',
    tool: 'endpoint',
    label: 'Run disk cleanup',
    description: 'Removes temp files, old update caches and the recycle bin contents.',
    result: 'Disk cleanup finished.',
  },
  {
    id: 'clear_credentials',
    tool: 'endpoint',
    label: 'Clear cached credentials',
    description: 'Removes stored Office/Windows credentials from Credential Manager.',
    result: 'Cached credentials removed.',
  },
  {
    id: 'deploy_vpn',
    tool: 'endpoint',
    label: 'Deploy latest VPN client',
    description: 'Pushes the current approved VPN client package to the device.',
    result: 'VPN client package deployed.',
  },
  {
    id: 'update_dock',
    tool: 'endpoint',
    label: 'Install dock driver & firmware',
    description: 'Pushes the approved docking station driver and firmware bundle.',
    result: 'Dock driver and firmware bundle installed.',
  },
  {
    id: 'disable_addin',
    tool: 'endpoint',
    label: 'Disable Office add-in',
    description: 'Disables a specific COM add-in for the user.',
    result: 'Add-in disabled for this user.',
  },
  {
    id: 'repair_office',
    tool: 'endpoint',
    label: 'Run Office online repair',
    description: 'Reinstalls Office in place. Takes 20-40 minutes.',
    result: 'Office online repair started. The user cannot use Office apps until it finishes.',
  },
  {
    id: 'clear_teams_cache',
    tool: 'endpoint',
    label: 'Clear Teams cache',
    description: 'Deletes the local Teams cache folder.',
    result: 'Teams cache cleared. Teams will rebuild it at next launch.',
  },
  {
    id: 'av_scan',
    tool: 'endpoint',
    label: 'Run full antivirus scan',
    description: 'Starts a full endpoint protection scan.',
    result: 'Full scan completed. No threats found.',
  },
  {
    id: 'isolate_device',
    tool: 'endpoint',
    label: 'Isolate device from network',
    description: 'Cuts all network traffic except to the security console.',
    result: 'Device isolated. Only the security management channel remains connected.',
  },
  {
    id: 'grant_admin',
    tool: 'endpoint',
    label: 'Grant temporary local admin',
    description: 'Adds the user to local Administrators for 24 hours.',
    result: 'User added to local Administrators.',
  },
  {
    id: 'reimage',
    tool: 'endpoint',
    label: 'Reimage device',
    description: 'Wipes and reinstalls the standard build. All local data is lost.',
    result: 'Reimage scheduled. The device will be wiped at next restart.',
  },

  // ----- Guided steps (things you ask the user to do) -----
  {
    id: 'guide_restart',
    tool: 'guide',
    label: 'Ask user to restart their computer',
    description: 'A clean restart, saving work first.',
    result: 'The user restarted and is back at the desktop.',
  },
  {
    id: 'guide_reseat_cable',
    tool: 'guide',
    label: 'Ask user to reseat network / dock cable',
    description: 'Unplug and firmly reconnect the cable at both ends.',
    result: 'The user unplugged and reconnected the cable.',
  },
  {
    id: 'guide_check_power',
    tool: 'guide',
    label: 'Ask user to check power adapter & LEDs',
    description: 'Try another outlet, check the adapter LED and the charging light.',
    result: 'The user checked the adapter and outlet.',
  },
  {
    id: 'guide_phone_password',
    tool: 'guide',
    label: 'Walk user through updating password on phone',
    description: 'Update saved password in the phone mail / Wi-Fi settings.',
    result: 'The user updated the saved password on their phone.',
  },
  {
    id: 'guide_camera_privacy',
    tool: 'guide',
    label: 'Walk user through camera privacy settings',
    description: 'Settings > Privacy & security > Camera.',
    result: 'The user opened the camera privacy settings.',
  },
  {
    id: 'guide_software_center',
    tool: 'guide',
    label: 'Direct user to Software Center',
    description: 'Self-service catalog of approved software.',
    result: 'The user opened Software Center.',
  },
  {
    id: 'guide_close_browser',
    tool: 'guide',
    label: 'Have user force-close browser & block site notifications',
    description: 'Task Manager > end browser, then remove the site from notification permissions.',
    result: 'The user closed the browser and removed the notification permission.',
  },
  {
    id: 'guide_safe_mode',
    tool: 'guide',
    label: 'Have user open the app in safe mode',
    description: 'Hold Ctrl while launching the Office app.',
    result: 'The user opened the app in safe mode.',
  },
  {
    id: 'guide_mfa_enroll',
    tool: 'guide',
    label: 'Walk user through MFA enrollment',
    description: 'Install the authenticator app and scan the QR code.',
    result: 'The user went through the enrollment screens.',
  },
  {
    id: 'guide_archive',
    tool: 'guide',
    label: 'Walk user through cleaning up mailbox',
    description: 'Empty Deleted Items, remove large attachments.',
    result: 'The user deleted some old items.',
  },
  {
    id: 'guide_disconnect',
    tool: 'guide',
    label: 'Ask user to disconnect from the network',
    description: 'Unplug the cable / turn Wi-Fi off, but leave the device powered on.',
    result: 'The user disconnected the device from the network.',
  },
];

export const ACTION_BY_ID: Record<string, CatalogAction> = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

export const TOOL_LABELS: Record<ToolId, string> = {
  directory: 'Directory & Mailbox',
  endpoint: 'Endpoint Manager',
  guide: 'Guided Steps',
};

export function actionsForTool(tool: ToolId): CatalogAction[] {
  return ACTIONS.filter((a) => a.tool === tool);
}
