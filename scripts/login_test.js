import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate } from 'k6/metrics';

const users = new SharedArray('users', function () {
  return open('../data/users.csv')
    .split('\n')
    .slice(1)
    .map(line => {
      const parts = line.split(',');
      return { username: parts[0], password: parts[1] };
    });
});

export const systemErrors = new Rate('system_errors');

export const options = {
  scenarios: {
    login_test: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 10,
      maxVUs: 50,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    system_errors: ['rate<0.03'],
  },
};

export default function () {
  const user = users[Math.floor(Math.random() * users.length)];

  const url = 'https://fakestoreapi.com/auth/login';

  const payload = JSON.stringify({
    username: user.username,
    password: user.password,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(url, payload, params);

  systemErrors.add(res.status >= 500);

  check(res, {
    'response time < 1500ms': r => r.timings.duration < 1500,
    'status is 200 or 401': r => r.status === 200 || r.status === 401,
  });

  sleep(0.1);
}
