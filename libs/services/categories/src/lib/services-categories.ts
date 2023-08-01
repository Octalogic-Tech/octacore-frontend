import { UseQueryResult, useQuery } from 'react-query';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: "https://jsonplaceholder.typicode.com",
});

export type temporaryData = {
  id: number;
  userId: number;
  body: string;
  title: string;
};

const getCategoryData = async () => {
  const response = await apiClient.get<temporaryData[]>("/posts");
  return response.data;
};

export const postNewCategory = async () => {
  // const response = await apiClient.post<temporaryData[]>("/posts");
  // return response.data;
  return
};

export const updateCategoryTable =async () => {
  // await apiClient.update<temporaryData>(`/update/:${values.id}`);
  console.log("category edit")
  return
}

export const deleteCategoryById =async () => {
  // await apiClient.delete<temporaryData>(`/update/:${values.id}`);
  console.log("category edit")
  return
}

export const fetchCategoryTableData = ():UseQueryResult<temporaryData[], Error> => {
  return useQuery<temporaryData[], Error>('category-data', getCategoryData);
};

