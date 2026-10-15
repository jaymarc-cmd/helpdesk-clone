import type { AccountState, DeviceState, Scenario } from '../types';

export interface CommandResult {
  output: string;
  reveals: string[];
  /** Catalog action this command performs (e.g. ipconfig /flushdns -> flush_dns). */
  action?: string;
  clear?: boolean;
}

export const TERMINAL_HELP: { cmd: string; desc: string }[] = [
  { cmd: 'hostname', desc: 'Device name' },
  { cmd: 'whoami [/groups]', desc: 'Signed-in user and group memberships' },
  { cmd: 'ipconfig [/all | /flushdns | /displaydns | /release | /renew]', desc: 'IP configuration and DNS cache' },
  { cmd: 'ping <host>', desc: 'Test reachability (uses local DNS cache)' },
  { cmd: 'nslookup <host>', desc: 'Query the DNS server directly' },
  { cmd: 'tracert <host>', desc: 'Show the network path' },
  { cmd: 'Test-NetConnection <host> -Port <n>', desc: 'Test a TCP port' },
  { cmd: 'gpupdate /force', desc: 'Refresh group policy' },
  { cmd: 'systeminfo', desc: 'OS and hardware summary' },
  { cmd: 'net use', desc: 'Mapped network drives' },
  { cmd: 'Get-PSDrive C', desc: 'Disk usage of C:' },
  { cmd: 'Get-PrintJob', desc: 'Jobs in the print queue' },
  { cmd: 'Get-Service spooler', desc: 'Print spooler status' },
  { cmd: 'Get-EventLog Application -Newest 5', desc: 'Recent application events' },
  { cmd: 'cmdkey /list', desc: 'Stored credentials' },
  { cmd: 'tasklist', desc: 'Running processes' },
  { cmd: 'cls', desc: 'Clear the screen' },
];

export function normalizeCommand(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

function hashOctet(s: string, min = 2, max = 250): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return min + (h % (max - min));
}

function isApipa(device: DeviceState): boolean {
  return device.ip.startsWith('169.254');
}

function isPoweredOff(device: DeviceState): boolean {
  return !device.online && device.ip === '';
}

export function resolveHost(host: string, device: DeviceState): string | null {
  const h = host.toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(h)) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return h;
  if (h === 'gateway' || h === 'router') return device.gateway || null;
  if (h === 'localhost') return '127.0.0.1';
  if (h === device.hostname.toLowerCase()) return device.ip;
  const internal = h.endsWith('.hpl.example') || !h.includes('.');
  if (internal) return `10.10.${hashOctet(h, 1, 30)}.${hashOctet(h + 'x')}`;
  return `203.0.113.${hashOctet(h)}`;
}

function pingOutput(host: string, ip: string, ok: boolean): string {
  const header = `Pinging ${host}${host !== ip ? ` [${ip}]` : ''} with 32 bytes of data:`;
  if (!ok) {
    return `${header}\nRequest timed out.\nRequest timed out.\nRequest timed out.\nRequest timed out.\n\nPing statistics for ${ip}:\n    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss)`;
  }
  const t = 1 + (hashOctet(ip) % 20);
  const lines = [0, 1, 2, 3].map((i) => `Reply from ${ip}: bytes=32 time=${t + (i % 2)}ms TTL=${ip.startsWith('10.') ? 126 : 54}`);
  return `${header}\n${lines.join('\n')}\n\nPing statistics for ${ip}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)`;
}

function ipconfig(device: DeviceState, all: boolean): string {
  if (!device.ip) {
    return 'Windows IP Configuration\n\nEthernet adapter Ethernet:\n\n   Media State . . . . . . . . . . . : Media disconnected';
  }
  const apipa = isApipa(device);
  const lines = ['Windows IP Configuration', ''];
  if (all) {
    lines.push(`   Host Name . . . . . . . . . . . . : ${device.hostname}`, '   Primary Dns Suffix  . . . . . . . : hpl.example', '');
  }
  lines.push('Ethernet adapter Ethernet:', '');
  if (all) {
    lines.push('   DHCP Enabled. . . . . . . . . . . : Yes', '   Autoconfiguration Enabled . . . . : Yes');
  }
  lines.push(
    apipa
      ? `   Autoconfiguration IPv4 Address. . : ${device.ip}(Preferred)`
      : `   IPv4 Address. . . . . . . . . . . : ${device.ip}(Preferred)`,
    `   Subnet Mask . . . . . . . . . . . : ${apipa ? '255.255.0.0' : '255.255.255.0'}`,
    `   Default Gateway . . . . . . . . . : ${device.gateway}`,
  );
  if (all) {
    lines.push(
      `   DHCP Server . . . . . . . . . . . : ${apipa ? '' : device.gateway.startsWith('192.168') ? device.gateway : '10.20.0.5'}`,
      `   DNS Servers . . . . . . . . . . . : ${device.dns}`,
    );
  }
  return lines.join('\n');
}

function generic(cmd: string, parts: string[], device: DeviceState, account: AccountState): CommandResult {
  const offline = !device.online;
  const out = (output: string, action?: string): CommandResult => ({ output, reveals: [], action });
  const target = parts[1];

  switch (parts[0]) {
    case 'help':
    case '?':
      return out(
        'Available commands:\n' + TERMINAL_HELP.map((h) => `  ${h.cmd.padEnd(44)} ${h.desc}`).join('\n'),
      );
    case 'cls':
    case 'clear':
      return { output: '', reveals: [], clear: true };
    case 'hostname':
      return out(device.hostname);
    case 'whoami':
      if (parts[1] === '/groups') {
        return out(
          'GROUP INFORMATION\n-----------------\n' +
            account.groups.map((g) => `HPL\\${g}`).join('\n') +
            '\nEveryone\nBUILTIN\\Users',
        );
      }
      return out(`hpl\\${account.username}`);
    case 'ipconfig': {
      const flag = parts[1];
      if (!flag) return out(ipconfig(device, false));
      if (flag === '/all') return out(ipconfig(device, true));
      if (flag === '/flushdns') return out('Windows IP Configuration\n\nSuccessfully flushed the DNS Resolver Cache.', 'flush_dns');
      if (flag === '/displaydns')
        return out(
          'Windows IP Configuration\n\n    outlook.office365.com\n    ----------------------------------------\n    Record Name . . . . . : outlook.office365.com\n    A (Host) Record . . . : 52.97.146.2\n\n    intranet.hpl.example\n    ----------------------------------------\n    A (Host) Record . . . : 10.10.2.14',
        );
      if (flag === '/release') return out('Windows IP Configuration\n\nEthernet adapter Ethernet:\n   (address released)');
      if (flag === '/renew') {
        if (isApipa(device) || !device.ip)
          return out(
            'Windows IP Configuration\n\nAn error occurred while renewing interface Ethernet : unable to contact your DHCP server. Request has timed out.',
          );
        return out(ipconfig(device, false));
      }
      return out(`Error: unrecognized or incomplete command line.\nUSAGE: ipconfig [/all | /flushdns | /displaydns | /release | /renew]`);
    }
    case 'ping': {
      if (!target) return out('Usage: ping <host>');
      if (offline) return out(`PING: transmit failed. General failure.`);
      const ip = resolveHost(target, device);
      if (!ip) return out(`Ping request could not find host ${target}. Please check the name and try again.`);
      return out(pingOutput(target, ip, true));
    }
    case 'nslookup': {
      if (!target) return out(`Default Server:  dns01.hpl.example\nAddress:  ${device.dns || '10.20.0.10'}`);
      if (offline) return out("DNS request timed out.\n    timeout was 2 seconds.\n*** Can't find server name for address: Timed out");
      const ip = resolveHost(target, device);
      if (!ip) return out(`*** dns01.hpl.example can't find ${target}: Non-existent domain`);
      return out(`Server:  dns01.hpl.example\nAddress:  ${device.dns}\n\nName:    ${target}\nAddress:  ${ip}`);
    }
    case 'tracert': {
      if (!target) return out('Usage: tracert <host>');
      if (offline) return out('Unable to resolve target system name. General failure.');
      const ip = resolveHost(target, device);
      if (!ip) return out(`Unable to resolve target system name ${target}.`);
      const hops = [device.gateway, '10.20.0.1', ip.startsWith('10.') ? ip : '198.51.100.1', ip];
      return out(
        `Tracing route to ${target} [${ip}]\nover a maximum of 30 hops:\n\n` +
          [...new Set(hops)].map((h, i) => `  ${i + 1}    <1 ms    1 ms    <1 ms  ${h}`).join('\n') +
          '\n\nTrace complete.',
      );
    }
    case 'test-netconnection': {
      if (!target) return out('Usage: Test-NetConnection <host> -Port <n>');
      const ip = resolveHost(target, device) ?? '0.0.0.0';
      const portIdx = parts.indexOf('-port');
      const port = portIdx > -1 ? parts[portIdx + 1] : undefined;
      return out(
        `ComputerName     : ${target}\nRemoteAddress    : ${ip}\n${port ? `RemotePort       : ${port}\nTcpTestSucceeded : ${offline ? 'False' : 'True'}` : `PingSucceeded    : ${offline ? 'False' : 'True'}`}`,
      );
    }
    case 'gpupdate':
      if (offline)
        return out('Updating policy...\n\nComputer policy could not be updated successfully. The processing of Group Policy failed because of lack of network connectivity to a domain controller.');
      return out('Updating policy...\n\nComputer Policy update has completed successfully.\nUser Policy update has completed successfully.');
    case 'systeminfo':
      return out(
        `Host Name:                 ${device.hostname}\nOS Name:                   ${device.os}\nSystem Model:              ${device.model}\nSystem Boot Time:          ${device.uptime} ago\nDomain:                    hpl.example\nLogon Server:              ${offline ? 'N/A' : '\\\\DC01'}\nHotfix(s):                 Last installed ${device.lastPatch}`,
      );
    case 'net':
      if (parts[1] === 'use')
        return out(
          `Status       Local     Remote                              Network\n-------------------------------------------------------------------\n${offline ? 'Unavailable' : 'OK         '}  H:        \\\\fs01\\home$\\${account.username}   Microsoft Windows Network\nThe command completed successfully.`,
        );
      return out('The syntax of this command is:\n\nNET [ USE | USER | GROUP ]');
    case 'get-psdrive': {
      const m = device.diskFree.match(/([\d.]+)\s*GB of\s*([\d.]+)/i);
      const free = m ? parseFloat(m[1]) : 100;
      const total = m ? parseFloat(m[2]) : 238;
      return out(
        `Name  Used (GB)  Free (GB)  Provider    Root\n----  ---------  ---------  --------    ----\nC     ${(total - free).toFixed(1).padStart(9)}  ${free.toFixed(1).padStart(9)}  FileSystem  C:\\`,
      );
    }
    case 'get-printjob':
      return out('(no print jobs)');
    case 'get-service':
      return out(`Status   Name               DisplayName\n------   ----               -----------\nRunning  ${(parts[1] ?? 'spooler').padEnd(18)} ${parts[1] === 'spooler' || !parts[1] ? 'Print Spooler' : parts[1]}`);
    case 'sc':
      return out('SERVICE_NAME: spooler\n        TYPE               : 110  WIN32_OWN_PROCESS\n        STATE              : 4  RUNNING');
    case 'get-eventlog':
      return out(
        'Index Time          EntryType   Source                 Message\n----- ----          ---------   ------                 -------\n88190 Today 08:12   Information Office Software Prot.  License check succeeded\n88175 Today 08:01   Information Winlogon               User logon notification\n88160 Yesterday     Information MsiInstaller           Windows Installer reconfigured the product\n88152 Yesterday     Warning     Outlook                Search indexing paused\n88140 Yesterday     Information EventSystem            Service started',
      );
    case 'cmdkey':
      return out(
        'Currently stored credentials:\n\n    Target: LegacyGeneric:target=msteams_adalsso/adal_context_0\n    Type: Generic\n    User: ' +
          account.username +
          '@hpl.example',
      );
    case 'tasklist':
      return out(
        'Image Name                     PID Session Name        Mem Usage\n========================= ======== ================ ============\nexplorer.exe                  4120 Console             98,212 K\nOUTLOOK.EXE                   6532 Console            312,904 K\nms-teams.exe                  7012 Console            401,330 K\nmsedge.exe                    8120 Console            220,118 K',
      );
    default:
      return out(`'${cmd.split(' ')[0]}' is not recognized as an internal or external command,\noperable program or batch file. Type 'help' for a list of commands.`);
  }
}

/**
 * Runs a simulated command on the requester's device.
 * Scenario overrides win over generated output; "whenDone" variants apply after a given action was performed.
 */
export function runCommand(
  raw: string,
  scenario: Scenario,
  device: DeviceState,
  account: AccountState,
  performedActions: string[],
): CommandResult {
  const cmd = normalizeCommand(raw);
  if (!cmd) return { output: '', reveals: [] };
  const parts = cmd.split(' ');
  const overrides = scenario.terminal ?? {};
  const overrideKey = Object.keys(overrides).find((k) => {
    const nk = normalizeCommand(k);
    return cmd === nk || cmd.startsWith(nk + ' ');
  });

  const base = generic(cmd, parts, device, account);
  if (base.clear) return base;

  if (overrideKey) {
    const o = overrides[overrideKey];
    const done = o.whenDone && performedActions.includes(o.whenDone.action);
    const output = done ? o.whenDone!.output : o.output ?? base.output;
    return { output, reveals: o.reveals ?? [], action: base.action };
  }

  if (isPoweredOff(device) && !['help', '?', 'cls', 'clear'].includes(parts[0])) {
    return {
      output: `Remote session to ${device.hostname} failed: the device is powered off or unreachable.`,
      reveals: [],
    };
  }
  return base;
}
