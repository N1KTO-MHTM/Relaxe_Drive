
const http = require('http');

async function request(path, method, body, token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };
        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function main() {
    console.log('Registering TestDriver...');
    try {
        const reg = await request('/auth/register', 'POST', {
            nickname: 'TestDriver',
            password: 'password',
            phone: '555-0199',
            carPlateNumber: 'TEST-1',
            carType: 'SEDAN',
            carModelAndYear: 'Test Car 2024'
        });
        console.log('Register result:', reg);
    } catch (e) {
        console.log('Registration failed (maybe exists):', e.message);
    }

    console.log('Logging in as Admin...');
    const login = await request('/auth/login', 'POST', {
        nickname: 'Admin',
        password: 'Luka1Soso'
    });

    if (!login.accessToken) {
        console.error('Admin login failed:', login);
        return;
    }
    const token = login.accessToken;
    console.log('Admin logged in.');

    console.log('Finding TestDriver...');
    const users = await request('/users', 'GET', null, token);
    const driver = users.find(u => u.nickname === 'TestDriver');

    if (!driver) {
        console.error('TestDriver not found in users list.');
        return;
    }
    console.log('Found TestDriver ID:', driver.id);

    console.log('Approving Driver...');
    const approved = await request(`/users/${driver.id}/approve`, 'PATCH', {}, token);
    console.log('Approval result:', approved);
}

main();
