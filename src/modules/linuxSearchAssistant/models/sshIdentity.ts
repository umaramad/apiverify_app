import type { LinuxSearchTargetConfig } from './config'
import type { SshServerIdentity } from './ssh'

/** Map a portable target config to a non-secret SSH identity. */
export function toSshServerIdentity(target: LinuxSearchTargetConfig): SshServerIdentity {
  return {
    id: target.id,
    host: target.hostNameOrIp,
    port: target.sshPort,
    username: target.username,
    label: `${target.applicationName} @ ${target.serverName}`.trim(),
  }
}
