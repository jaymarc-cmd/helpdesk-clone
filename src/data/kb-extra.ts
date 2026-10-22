import type { KbArticle } from '../types';

/** Articles added alongside the second batch of scenarios. Merged into KB_ARTICLES in kb.ts. */
export const EXTRA_KB: KbArticle[] = [
  {
    id: 'kb-lost-device',
    title: 'Lost or stolen company phone',
    category: 'Security',
    tags: ['mobile', 'phone', 'lost', 'stolen', 'wipe', 'mdm', 'sessions'],
    body: `A lost phone holds company mail, chat and often the user's **MFA authenticator**. Act quickly, but verify first: a wipe cannot be undone.

## Steps
1. **Verify identity** (employee ID and manager, or a callback to the desk number on file).
2. Find the device in device management and note its **last check-in**.
3. Send a **remote wipe**. It runs the next time the phone connects to a network.
4. **Revoke all sign-in sessions** so cached tokens on the phone stop working.
5. If the authenticator was on the phone, reset MFA registration so the user can enrol their replacement.
6. Ask the user to report the loss to the transport operator or police if it was stolen, and raise a replacement request.

## Don't
- Wipe or isolate the user's **laptop** by mistake. Check the device name.
- Wait "in case it turns up". A recovered phone can be re-enrolled in minutes.`,
  },
  {
    id: 'kb-remote-access-policy',
    title: 'Remote access policy: personal devices',
    category: 'Network',
    tags: ['vpn', 'personal device', 'byod', 'home', 'remote access', 'policy', 'portal'],
    body: `The VPN gives a device a direct path into the company network, so it is only installed on **company-managed devices** (encrypted, patched, monitored).

## Personal computers
- **No VPN** on personal or family computers, even with a manager's approval.
- Offer the **web workspace portal** instead: email, Teams, OneDrive/SharePoint and published web apps in a browser, protected by MFA.
- If the person needs internal-only systems, their manager can request a **company laptop**.

## How to decline well
1. Find out what they actually need to reach from home.
2. Explain the reason briefly (security of the company network, not distrust of them).
3. Show them the approved alternative and check it covers their work.

Adding someone to **VPN Users** "so they can try it" is a policy breach.`,
  },
  {
    id: 'kb-shared-mailbox',
    title: 'Shared mailbox access requests',
    category: 'Email',
    tags: ['shared mailbox', 'delegate', 'full access', 'approval', 'outlook'],
    body: `Shared mailboxes (e.g. accounts-payable@) belong to a **mailbox owner**, usually the team lead.

1. Confirm which mailbox and what level of access is needed (**Full Access** to read and file, **Send As** is a separate approval).
2. Get the **owner's approval** and reference it on the ticket.
3. Grant Full Access in Directory.
4. Ask the user to **restart Outlook** (or sign out and back in). The mailbox is added automatically, which can take a few minutes.
5. Confirm they can open it.

Never add people to broad Finance or admin groups to "get them in faster".`,
  },
  {
    id: 'kb-joiners-leavers',
    title: 'Joiners and leavers',
    category: 'Accounts',
    tags: ['new starter', 'joiner', 'leaver', 'hr', 'disable', 'onboarding', 'offboarding', 'identity & access'],
    body: `Accounts follow the **HR record**. The HR feed pre-creates joiner accounts and activates them on the start date, and Identity & Access owns the workflow.

## New starters
- If an account exists but is **disabled**, check the scheduled activation date in the account note.
- If the HR start date is wrong, do **not** enable the account by hand: it skips licences, groups and MFA registration, and the next HR sync disables it again.
- Escalate to **Identity & Access** with the correct date and evidence; ask the manager to have HR correct the record.
- Never give a manager the new starter's password. Credentials go to the new starter directly.

## Leavers
1. Verify the requester, and confirm they are the leaver's **manager** in Directory or that **HR** has a leaver record.
2. **Disable** the account and **revoke all sessions** (disabling alone leaves existing sessions working).
3. Check the sign-in log for activity after the last working day and note it on the ticket.
4. Mailbox access for a leaver's manager needs **HR approval**. Point them to the leaver mailbox form.`,
  },
  {
    id: 'kb-mfa-fatigue',
    title: 'Unexpected MFA prompts (MFA fatigue)',
    category: 'Security',
    tags: ['mfa', 'push', 'prompt', 'fatigue', 'bombing', 'password', 'security'],
    body: `A sign-in approval prompt only appears **after the correct password** has been entered. Prompts the user did not start mean someone else has their password.

## Immediately
1. Tell the user to **deny every prompt** and never approve one "to make it stop".
2. Verify identity, then **reset the password** through the verified channel.
3. **Revoke all sessions**.
4. Check the **sign-in log**: password accepted, MFA denied, from where?
5. Ask whether the password was reused anywhere else (breached sites are the usual source).

## Don't
- Reset or remove MFA. It is the only thing stopping the attacker right now.

Escalate to **Security Operations** with the source IPs and times so they can block the source and check for other targets.`,
  },
  {
    id: 'kb-bitlocker',
    title: 'BitLocker recovery screen',
    category: 'Hardware',
    tags: ['bitlocker', 'recovery key', 'bios', 'firmware', 'tpm', 'encryption'],
    body: `BitLocker asks for the recovery key when the start-up measurements stored in the TPM change, most often after a **BIOS/firmware update** that ran without BitLocker being suspended.

1. **Verify identity**. The recovery key unlocks the whole disk.
2. Ask for the **Key ID** shown on the recovery screen (first 8 characters).
3. Retrieve the key from the device record in Directory and check the Key ID **matches**.
4. Read the 48-digit key to the verified owner, in groups of six. Never send it by email or chat to anyone else.
5. Windows starts normally and BitLocker resumes protection by itself.

If the Key ID does not match, or the device was out of the owner's hands, stop and escalate to Security Operations. **Never reimage** a laptop just because it is asking for a key.`,
  },
  {
    id: 'kb-onedrive-sync',
    title: 'OneDrive sync errors (red X)',
    category: 'Software',
    tags: ['onedrive', 'sync', 'red x', 'path too long', 'storage', 'files'],
    body: `A red X means OneDrive could not upload one or more items. Find out **which items** and **why** before resetting anything.

## Common causes
- **Path too long**: the full path (folders + file name) is over **400 characters**. Common after copying deeply nested folders from old file shares.
- **Storage full**: check usage against the quota.
- **Invalid names**: characters such as \`" * : < > ? / \\ |\`, or names like CON or desktop.ini.
- **Signed out** or paused client.

## Fix for long paths
1. Find the deepest folders in the error (\`Get-EventLog Application -Newest 5\` shows the OneDrive entry).
2. Have the user shorten folder names near the **top** of the tree, or move the folder higher up.
3. OneDrive retries automatically. The red X turns into a green tick.

Resetting the client or reinstalling Office does not fix a path that is too long.`,
  },
  {
    id: 'kb-audio-devices',
    title: 'No audio in Teams calls after docking',
    category: 'Software',
    tags: ['teams', 'audio', 'headset', 'microphone', 'speaker', 'dock', 'sound'],
    body: `When a laptop connects to a dock or monitor, new audio devices appear (monitor speakers, dock audio). Teams can switch to them and keep that choice.

1. Ask what changed: a new dock, desk or monitor?
2. Check whether the headset works in other apps. If it does, the hardware is fine.
3. In Teams: **Settings > Devices**. Pick the headset for **Speaker** and **Microphone**, then **Make a test call**.
4. If the laptop lid is closed, the built-in microphone cannot pick anything up, so never leave it selected while docked.

Reinstalling Teams or clearing its cache does not change the selected device.`,
  },
  {
    id: 'kb-wifi-certificates',
    title: 'Corporate Wi-Fi: certificate-based sign-in',
    category: 'Network',
    tags: ['wifi', 'wi-fi', 'wireless', 'certificate', 'profile', 'device management', 'new laptop'],
    body: `**HPL-Corp** uses a **device certificate**, not a password. The certificate and the Wi-Fi profile are delivered by device management after enrollment.

## "Can't connect to this network" on a new laptop
1. Confirm other devices connect fine (rules out an outage).
2. Check device management: are the **Wi-Fi certificate** and **HPL-Corp profile** applied or still pending?
3. Check the device: \`netsh wlan show profiles\` and \`certutil -store -user my\`.
4. If they are pending, **sync device policy** while the laptop is on a cable.
5. Have the user **forget** any copy of HPL-Corp they added by hand, then connect again.

Never give the user admin rights to import certificates themselves, and don't reimage a new laptop for a policy that simply has not synced.`,
  },
];
