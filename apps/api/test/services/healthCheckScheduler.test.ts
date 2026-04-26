import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HealthCheckScheduler } from '../../src/services/healthCheckScheduler.js';
import { healthCheckService } from '../../src/services/healthCheck.js';

vi.mock('../../src/services/healthCheck.js', () => ({
  healthCheckService: {
    checkDueServers: vi.fn().mockResolvedValue([]),
    checkServer: vi.fn().mockResolvedValue({}),
  },
}));

describe('HealthCheckScheduler', () => {
  let scheduler: HealthCheckScheduler;

  beforeEach(() => {
    scheduler = new HealthCheckScheduler(60000);
  });

  afterEach(() => {
    scheduler.stop();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('should start and stop', () => {
    scheduler.start();
    scheduler.stop();
    expect(healthCheckService.checkDueServers).toHaveBeenCalled();
  });

  it('should not start twice', () => {
    scheduler.start();
    scheduler.start();
    expect(healthCheckService.checkDueServers).toHaveBeenCalledTimes(1);
  });

  it('should run checks on interval', async () => {
    const callbacks: Function[] = [];
    vi.stubGlobal('setInterval', (cb: Function) => {
      callbacks.push(cb);
      return 1 as unknown as NodeJS.Timeout;
    });

    scheduler.start();
    expect(healthCheckService.checkDueServers).toHaveBeenCalledTimes(1);

    await new Promise(resolve => setTimeout(resolve, 0)); // let initial runChecks complete
    callbacks[0]();
    expect(healthCheckService.checkDueServers).toHaveBeenCalledTimes(2);
  });

  it('should skip overlapping runs', () => {
    const callbacks: Function[] = [];
    vi.stubGlobal('setInterval', (cb: Function) => {
      callbacks.push(cb);
      return 1 as unknown as NodeJS.Timeout;
    });
    vi.mocked(healthCheckService.checkDueServers).mockImplementation(() => new Promise(() => {}));
    scheduler.start();
    callbacks[0](); // simulate interval firing while run is in progress
    expect(healthCheckService.checkDueServers).toHaveBeenCalledTimes(1);
  });

  it('should trigger manual check', async () => {
    await scheduler.checkServerNow('test-server-id');
    expect(healthCheckService.checkServer).toHaveBeenCalledWith('test-server-id');
  });

  it('should propagate manual check errors', async () => {
    vi.mocked(healthCheckService.checkServer).mockRejectedValueOnce(new Error('Check failed'));
    await expect(scheduler.checkServerNow('test-server-id')).rejects.toThrow('Check failed');
  });
});
