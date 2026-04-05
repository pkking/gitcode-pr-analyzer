import axios from 'axios';

const BASE_URL = 'https://api.gitcode.com/api/v5';

const apiClient = axios.create({
  baseURL: BASE_URL,
});

export const getPRs = async (owner, repo, token, state = 'all') => {
  const response = await apiClient.get(`/repos/${owner}/${repo}/pulls`, {
    params: { access_token: token, state },
  });
  return response.data;
};

export const getPR = async (owner, repo, number, token) => {
  const response = await apiClient.get(`/repos/${owner}/${repo}/pulls/${number}`, {
    params: { access_token: token },
  });
  return response.data;
};

export const getComments = async (owner, repo, number, token) => {
  const response = await apiClient.get(`/repos/${owner}/${repo}/pulls/${number}/comments`, {
    params: { access_token: token },
  });
  return response.data;
};

export const getModifyHistory = async (owner, repo, number, token) => {
  const response = await apiClient.get(`/repos/${owner}/${repo}/pulls/${number}/modify_history`, {
    params: { access_token: token },
  });
  return response.data;
};
