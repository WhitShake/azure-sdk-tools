
export type MockEventTarget = {
    $emit (event: string, data: any): void;
    $emitted (event: string): boolean;
    on: jest.Mock;
    off: jest.Mock;
}

export type MockChildProcess = MockEventTarget & {
    readonly $args: any[];
    readonly $command: string;
    readonly $options: any;
    readonly $env: any;

    readonly stderr: MockEventTarget;
    readonly stdout: MockEventTarget;

    kill (): void;
}

type ChildProcessConstructor = [string, string[], any];

class MockEventTargetImpl implements MockEventTarget {
    private $handlers: Map<string, Function[]> = new Map();
    private $emittedEvents: Set<string> = new Set();

    public $emitted(event: string) {
        return this.$emittedEvents.has(event);
    }

    public $emit = (event: string, data: any) => {
        this.$emittedEvents.add(event);
        this.getHandlers(event).forEach((handler) => handler(data));
    };

    public kill = jest.fn();

    public off = jest.fn((event: string, handler: Function) => {
        this.delHandler(event, handler);
    });

    public on = jest.fn((event: string, handler: Function) => {
        this.addHandler(event, handler);
    });

    private addHandler(event: string, handler: Function) {
        this.$handlers.set(event, [
            ...(this.$handlers.get(event) || []),
            handler
        ]);
    }

    private delHandler(event: string, handler: Function) {
        const handlers = this.$handlers.get(event);
        if (!Array.isArray(handlers)) {
            return;
        }

        const index = handlers.indexOf(handler);
        if (index < 0) {
            return;
        }

        handlers.splice(index, 1);
    }

    private getHandlers(event: string) {
        const handlers = this.$handlers.get(event);
        if (!handlers?.length) {
            throw new Error('MockEventTarget:getHandlers no matching handlers attached');
        }

        return handlers;
    }
}

class MockChildProcessImpl extends MockEventTargetImpl implements MockChildProcess {
    public get $args() {
        return this.constructedWith[1];
    }
    public get $command() {
        return this.constructedWith[0];
    }
    public get $options() {
        return this.constructedWith[2];
    }
    public get $env() {
        return this.constructedWith[2]?.env;
    }

    public readonly stderr = new MockEventTargetImpl();
    public readonly stdout = new MockEventTargetImpl();

    constructor(private constructedWith: ChildProcessConstructor) {
        super();
    }
}

export const mockChildProcessModule = (function mockChildProcessModule() {
    const children: MockChildProcess[] = [];

    return {
        spawn: jest.fn((...args: ChildProcessConstructor) => addChild(new MockChildProcessImpl(args))),

        $mostRecent() {
            return children[children.length - 1];
        },

        $matchingChildProcess(what: string[] | ((mock: MockChildProcess) => boolean)): MockChildProcess | undefined {
            if (Array.isArray(what)) {
                return children.find((proc) =>
                    JSON.stringify(proc.$args) === JSON.stringify(what));
            }

            if (typeof what === 'function') {
                return children.find(what);
            }

            throw new Error('$matchingChildProcess needs either an array of commands or matcher function');
        },

        $reset() {
            children.length = 0;
        }
    };

    function addChild(child: MockChildProcess) {
        return children[children.length] = child;
    }
}());

export function wait(timeoutOrPromise: number | Promise<unknown> = 10): Promise<void> {
    if (timeoutOrPromise && typeof timeoutOrPromise === 'object' && typeof timeoutOrPromise.then === 'function') {
        return timeoutOrPromise.then(() => wait());
    }

    return new Promise((ok) => setTimeout(ok, typeof timeoutOrPromise === 'number' ? timeoutOrPromise : 10));
}

async function exitChildProcess(proc: MockChildProcess, data: string | null, exitSignal: number) {
    if (proc.$emitted('exit')) {
        throw new Error('exitChildProcess: attempting to exit an already closed process');
    }

    if (typeof data === 'string') {
        proc.stdout.$emit('data', Buffer.from(data));
    }

    proc.$emit('exit', exitSignal);
    proc.$emit('close', exitSignal);
}

export async function closeWithSuccess(message = '') {
    await wait();
    const match = mockChildProcessModule.$matchingChildProcess((p) => !p.$emitted('exit'));
    if (!match) {
        throw new Error(`closeWithSuccess unable to find matching child process`);
    }
    await exitChildProcess(match, message, 0);
    await wait();
}

jest.mock('child_process', () => mockChildProcessModule);

afterEach(() => {
    mockChildProcessModule.$reset();
});
