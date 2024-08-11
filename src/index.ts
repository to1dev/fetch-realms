import { Router } from 'itty-router';
import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { fetchApiServer } from './utils';

const PUBLIC_ELECTRUMX_ENDPOINT1 = 'blockchain.atomicals.find_realms';
const PUBLIC_ELECTRUMX_ENDPOINT2 = 'blockchain.atomicals.get_state';
const PUBLIC_ELECTRUMX_ENDPOINT3 = 'blockchain.atomicals.list';

interface RealmResult {
    atomical_id: string;
    realm: string;
    realm_hex: string;
    status: string;
    tx_num: number;
}

interface RealmData {
    id: string;
    number: number;
    mintAddress: string;
    address: string;
    pid: string;
}

const mainnet = {
    bech32: 'bc',
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
};

function scriptAddress(hexScript: string): string | null {
    if (!hexScript) {
        return null;
    }

    const addr = btc.Address(mainnet);
    const script = hex.decode(hexScript);
    const parsedScript = btc.OutScript.decode(script);
    const parsedAddress = addr.encode(parsedScript);

    return parsedAddress;
}

async function saveToD1(env: Env, realm: string, data: RealmData): Promise<boolean> {
    async function _exists(realm: string): Promise<boolean> {
        const sql = `SELECT RealmName FROM _realms WHERE RealmName = ?1 LIMIT 1`;
        const _realm = await env.MY_DB.prepare(sql).bind(realm).first();
        return _realm !== null;
    }

    async function _save(): Promise<boolean> {
        const { success } = await env.MY_DB.prepare(
            `insert into _realms (RealmName, RealmId, RealmNumber, RealmMinter, RealmOwner, ProfileId) values (?1, ?2, ?3, ?4, ?5, ?6)`
        )
            .bind(realm, data?.id, data?.number, data?.mintAddress, data?.address, data?.pid)
            .run();
        console.log('insert succeed');
        return success;
    }

    async function _update(): Promise<boolean> {
        const { success } = await env.MY_DB.prepare(
            `update _realms set
                RealmOwner = ?1,
                ProfileId = ?2
             where RealmName = ?3`
        )
            .bind(data?.address, data?.pid, realm)
            .run();
        console.log('update succeed');
        return success;
    }

    const exists = await _exists(realm);
    if (!exists) {
        console.log('not exists');
        return await _save();
    } else {
        console.log('exists');
        return await _update();
    }

    return false;
}

async function getRealm(id: string): Promise<any | null> {
    const endpoint = PUBLIC_ELECTRUMX_ENDPOINT2;
    const path: string = `${endpoint}?params=["${id}"]`;

    try {
        const res = await fetchApiServer(path);
        if (!res.ok) {
            throw new Error(`Error fetching data: ${res.statusText}`);
        }

        const data: any = await res.json();
        if (!data) {
            return null;
        }

        if (!data?.success) {
            console.error(`Error getting right json result: ${res.statusText}`);
            return null;
        }

        const number = data.response?.result?.atomical_number;
        let mintAddress = scriptAddress(data.response?.result?.mint_info?.reveal_location_script);
        let address = scriptAddress(data.response?.result?.location_info[0]?.script);
        const pid = data.response?.result?.state?.latest?.d || null;

        return { id, number, mintAddress, address, pid };
    } catch (e) {
        console.error('Failed to fetch realm:', e);
        return null;
    }
}

async function processRealms(env: Env, results: RealmResult[]) {
    if (results.length > 0) {
        const endpoint = PUBLIC_ELECTRUMX_ENDPOINT2;

        for (const result of results) {
            const realm = result?.realm;
            const id = result?.atomical_id;
            const data = await getRealm(id);
            if (data) {
                //console.log(data);
                await saveToD1(env, realm, data);
            }
        }
    }
}

async function getRealms(env: Env, ctx: ExecutionContext): Promise<void> {
    const pageSize = 1000;
    let page = 0;
    let offset = 0;
    let totalFetched = 0;
    let moreData = true;

    const endpoint = PUBLIC_ELECTRUMX_ENDPOINT1;

    while (moreData) {
        const path: string = `${endpoint}?params=["",false,${pageSize},${offset},true]`;

        try {
            const res = await fetchApiServer(path);
            if (!res.ok) {
                console.error(`Error fetching data: ${res.statusText}`);
                return;
            }

            const data = await res.json();
            if (!data) {
                return;
            }

            if (!data?.success) {
                console.error(`Error getting right json result: ${res.statusText}`);
                return;
            }

            const results = data.response?.result;
            if (!results) {
                return;
            }

            await processRealms(env, results);

            totalFetched += results.length;
            if (results.length < pageSize) {
                moreData = false;
            } else {
                page++;
                offset = page * pageSize;
            }
        } catch (e) {
            console.error('Failed to fetch realms:', e);
            return;
        }
    }

    return;
}

async function getLatestRealms(env: Env, ctx: ExecutionContext): Promise<void> {
    const endpoint = PUBLIC_ELECTRUMX_ENDPOINT3;

    const path: string = `${endpoint}?params=[50,-1,false]`;

    try {
        const res = await fetchApiServer(path);
        if (!res.ok) {
            console.error(`Error fetching data: ${res.statusText}`);
            return;
        }

        const data = await res.json();
        if (!data) {
            return;
        }

        if (!data?.success) {
            console.error(`Error getting right json result: ${res.statusText}`);
            return;
        }

        const results = data.response?.result;
        if (!results) {
            return;
        }

        if (Array.isArray(results) && results.length > 0) {
            for (const result of results) {
                const realm = result?.$full_realm_name;
                const id = result?.atomical_id;
                const type = result?.type;
                const subtype = result?.subtype;
                if (type === 'NFT' && ['realm', 'subrealm'].includes(subtype)) {
                    const data = await getRealm(id);
                    if (data) {
                        //console.log(data);
                        await saveToD1(env, realm, data);
                    }
                }
            }
        }
    } catch (e) {
        console.error('Failed to fetch latest realms:', e);
        return;
    }
}

const router = Router();

router.get('/action/:action', async (req, env, ctx) => {
    const action = req.params.action;

    return new Response(`hello world, ${action}`, { headers: { 'Content-Type': 'application/json' } });
});

export default {
    async scheduled(event, env, ctx): Promise<void> {
        switch (event.cron) {
            case '* * * * *':
                //await getLatestRealms(env, ctx);
                break;

            case '*/10 * * * *':
                const cacheKey = `counter:fetch-realms`;
                const cachedData = await env.api.get(cacheKey, { type: 'json' });
                if (cachedData) {
                } else {
                    await getRealms(env, ctx);
                    ctx.waitUntil(env.api.put(cacheKey, JSON.stringify({ counter: 1 })));
                }
                break;

            default:
                break;
        }
        console.log('cron processed');
    },

    async fetch(req, env, ctx) {
        const url = new URL(req.url);
        if (url.pathname.startsWith('/action')) {
            return await router.handle(req, env, ctx);
        }

        return new Response('Hello world!', { headers: { 'Content-Type': 'application/json' } });
    },
} satisfies ExportedHandler<Env>;
