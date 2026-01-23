export interface ProcessorInfo {
  id: string;
  hostname: string;
  ipAddress: string;
  lastHeartbeat: number;
  pid: number;
  startedAt: number;
  status: "running" | "stopped" | "error";
}
