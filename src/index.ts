import { fetchApiServer } from './utils';

const PUBLIC_ELECTRUMX_ENDPOINT1 = 'blockchain.atomicals.find_realms';

interface Realm {
    atomical_id: string;
    realm: string;
    realm_hex: string;
    status: string;
    tx_num: number;
}

async function processData(results: Realm[]) {
    if (results.length > 0) {
        for (const result of results) {
            console.log(result?.realm);
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
            const path: string = `${endpoint}?params=["",false,${pageSize},${offset}]`;

            const res = await fetchApiServer(path);
            if (!res.ok) {
                console.error(`Error fetching data: ${res.statusText}`);
                return;
            }

            const data = await res.json();
            if (!data) {
                return;
            }

            const results = data.response?.result;
            if (!results) {
                return;
            }

            await processData(results);

            totalFetched += results.length;
            if (results.length < pageSize) {
                moreData = false;
            } else {
                page++;
                offset = page * pageSize;
            }
        }
    },
} satisfies ExportedHandler<Env>;
