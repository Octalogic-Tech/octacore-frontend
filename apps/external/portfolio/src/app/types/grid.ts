import { ICategory } from './category';

export interface IBox {
  count: number;
  rowspan: number;
  colspan: number;
  category: ICategory;
}
