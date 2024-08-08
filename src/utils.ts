const apiServers = ['https://ep.wizz.cash/proxy', 'https://ep.atomicalmarket.com/proxy', 'https://ep.nextdao.xyz/proxy'];

function createHeaders(): Headers {
    return new Headers({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        Connection: 'keep-alive',
    });
}

export async function fetchApiServer(path: string, index: number = -1): Promise<any> {
    for (let i = 0; i < apiServers.length; i++) {
        let randomIndex = Math.floor(Math.random() * apiServers.length);
        if (index > -1) {
            randomIndex = index;
        }
        const apiUrl = `${apiServers[randomIndex]}/${path}`;
        const headers = createHeaders();
        const newRequest = new Request(apiUrl, {
            method: 'GET',
            headers: headers,
        });

        try {
            const response = await fetch(newRequest);
            if (response.ok) {
                return response;
            } else {
                console.warn(`Server ${apiUrl} responded with status ${response.status}`);
            }
        } catch (error) {
            console.error(`Error fetching from ${apiUrl}:`, error);
        }
    }

    return new Response('All API servers are unavailable', { status: 503 });
}
