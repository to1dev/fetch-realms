import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { fetchApiServer } from './utils';

const PUBLIC_ELECTRUMX_ENDPOINT1 = 'blockchain.atomicals.find_realms';
const PUBLIC_ELECTRUMX_ENDPOINT2 = 'blockchain.atomicals.get_state';

interface Realm {
    atomical_id: string;
    realm: string;
    realm_hex: string;
    status: string;
    tx_num: number;
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

async function processRealms(results: Realm[]) {
    if (results.length > 0) {
        const endpoint = PUBLIC_ELECTRUMX_ENDPOINT2;

        for (const result of results) {
            const realm = result?.realm;
            const id = result?.atomical_id;
            const path: string = `${endpoint}?params=["${id}"]`;

            try {
                const res = await fetchApiServer(path);
                if (!res.ok) {
                    throw new Error(`Error fetching data: ${res.statusText}`);
                }

                const data: any = await res.json();
                if (!data) {
                    return;
                }

                if (!data?.success) {
                    console.error(`Error getting right json result: ${res.statusText}`);
                    return;
                }

                const number = data.response?.result?.atomical_number;
                let mintAddress = scriptAddress(data.response?.result?.mint_info?.reveal_location_script);
                let address = scriptAddress(data.response?.result?.location_info[0]?.script);
                const pid = data.response?.result?.state?.latest?.d;

                const _results = {
                    realm,
                    id,
                    number,
                    mintAddress,
                    address,
                    pid,
                };
            } catch (e) {
                console.error('Failed to fetch realm profile id:', e);
                return;
            }
        }
    }
}

export default {
    async scheduled(event, env, ctx): Promise<void> {
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

                await processRealms(results);

                totalFetched += results.length;
                if (results.length < pageSize) {
                    moreData = false;
                } else {
                    page++;
                    offset = page * pageSize;
                }
            } catch (e) {
                console.error('Failed to fetch realm:', e);
                return;
            }
        }
    },
} satisfies ExportedHandler<Env>;
