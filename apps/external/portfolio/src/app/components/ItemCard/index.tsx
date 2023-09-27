import { Card, CardContent } from '../Card';

import styles from './styles.module.css';

import { IBox } from '../../types/grid';

export interface IItemCard {
  box: IBox;
  columnCount: number;
  rowCount: number;
  boxCount: number;
}

export const ItemCard = ({ box }: IItemCard) => {
  return (
    <Card
      className={`min-h-[10rem] min-w-[10rem] rounded-xl text-center row-span-1 col-span-1 lg:row-span-${box.rowspan} lg:col-span-${box.colspan} bg-no-repeat bg-cover bg-center`}
      key={box.count}
      style={{ backgroundImage: `url(${box.category?.cover})` }}
    >
      <CardContent className="relative h-full p-0">
        <div className={styles.container}>
          <div className={styles.content}>
            <p className={styles.title}>{box.category.name}</p>
            <p className={styles.subtitle}>{box.category?.description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
