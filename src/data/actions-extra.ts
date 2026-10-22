import type { CatalogAction } from '../types';

/** Actions added alongside the second batch of scenarios. Merged into ACTIONS in actions.ts. */
export const EXTRA_ACTIONS: CatalogAction[] = [
  // ----- Directory & mailbox -----
  {
    id: 'disable_account',
    tool: 'directory',
    label: 'Disable account',
    description: 'Blocks sign-in for the account. Mailbox and files are kept for the retention period.',
    sensitive: true,
    result: 'Account disabled. New sign-ins are blocked; existing sessions stay valid until they are revoked.',
  },
  {
    id: 'grant_mailbox_access',
    tool: 'directory',
    label: 'Grant shared mailbox access (Full Access)',
    description: 'Gives the user Full Access to a shared mailbox. Needs the mailbox owner’s approval.',
    sensitive: true,
    result: 'Full Access granted. The mailbox appears in Outlook automatically after Outlook restarts.',
  },
  {
    id: 'view_bitlocker_key',
    tool: 'directory',
    label: 'Retrieve BitLocker recovery key',
    description: 'Reads the recovery key escrowed for the user’s device. Only read it out to the verified device owner.',
    sensitive: true,
    result: 'Recovery key retrieved from the device record. Access to the key has been audited.',
  },

  // ----- Endpoint management -----
  {
    id: 'mdm_wipe_device',
    tool: 'endpoint',
    label: 'Remote wipe mobile device (MDM)',
    description: 'Sends a factory-reset command to a managed phone or tablet the next time it checks in.',
    sensitive: true,
    result: 'Wipe command queued. It runs the next time the device connects to any network.',
  },

  // ----- Deployment -----
  {
    id: 'sync_device_policy',
    tool: 'deploy',
    label: 'Pending device policies (Wi-Fi certificate & profile)',
    description: 'Forces the device to check in with device management and apply every pending certificate and configuration profile.',
    result: 'Device checked in and applied its pending policies.',
  },

  // ----- Guided steps -----
  {
    id: 'guide_bitlocker_key',
    tool: 'guide',
    label: 'Walk user through entering the BitLocker recovery key',
    description: 'Match the Key ID on screen, then type the 48-digit key in groups of six.',
    result: 'The user typed the recovery key and Windows started.',
  },
  {
    id: 'guide_wifi_reconnect',
    tool: 'guide',
    label: 'Ask user to forget and reconnect to the Wi-Fi network',
    description: 'Forget any manually added copy of the network, unplug the cable and connect to it again.',
    result: 'The user forgot the network and connected again.',
  },
  {
    id: 'guide_audio_device',
    tool: 'guide',
    label: 'Walk user through Teams audio device settings',
    description: 'Teams > Settings > Devices: pick the headset for speaker and microphone, then make a test call.',
    result: 'The user picked their headset in the Teams device settings.',
  },
  {
    id: 'guide_onedrive_shorten',
    tool: 'guide',
    label: 'Walk user through shortening long OneDrive paths',
    description: 'Rename or move deeply nested folders so every file path is under the 400-character limit.',
    result: 'The user shortened the folder names.',
  },
  {
    id: 'guide_web_portal',
    tool: 'guide',
    label: 'Direct user to the web workspace portal',
    description: 'Browser-based access to email, Teams, files and published web apps from any device, protected by MFA.',
    result: 'The user signed in to the web workspace portal.',
  },
];
