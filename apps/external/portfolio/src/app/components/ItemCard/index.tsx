import { IBox } from '../../types/grid';

export interface IItemCard {
  box: IBox;
  columnCount: number;
  rowCount: number;
  boxCount: number;
}

export const ItemCard = ({ box }: IItemCard) => {
  console.log("🚀 ~ file: index.tsx:11 ~ ItemCard ~ box:", box)
  return (
    <div
      className={`min-h-[10rem] min-w-[10rem] rounded-md bg-blue-200 p-4 text-center row-span-1 col-span-1 lg:row-span-${box.rowspan} lg:col-span-${box.colspan}`}
      key={box.count}
    >
      {box.count}
    </div>
  );
};
