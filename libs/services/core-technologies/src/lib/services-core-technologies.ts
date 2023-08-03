import { UseQueryResult, useQuery } from 'react-query';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3001',
});

export type technologiesDataType = {
  id: number;
  name: string;
  description: string;
  iconType: string;
  iconName: string;
  category: string;
};

const getTechnologiesData = async () => {
  const response = await apiClient.get<technologiesDataType[]>('/technologies');
  return response.data;
};

export function servicesCoreTechnologies(): UseQueryResult<technologiesDataType[], Error> {
  return useQuery<technologiesDataType[], Error>('techology-data', getTechnologiesData);
}
