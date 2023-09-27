import { useEffect, useState } from 'react';
import { ItemCard } from '../../components/ItemCard';
import { exceptions, gridExceptionHandler } from '../../utils/grid';

export const Home = () => {
  const [boxCount, setBoxCount] = useState(7); // You can change this number

  let boxArray = Array.from({ length: boxCount }, (_, i) => {
    return { count: i + 1, rowspan: 1, colspan: 1 };
  });
  let columnCount = 1;
  let rowCount = 1;

  if (exceptions.includes(boxCount)) {
    const { adjustedBoxArray, adjustedRowCount, adjustedColumnCount } =
      gridExceptionHandler(boxCount, boxArray);

    columnCount = adjustedColumnCount;
    rowCount = adjustedRowCount;
    boxArray = [...adjustedBoxArray];
  } else {
    const sqrt = Math.ceil(Math.sqrt(boxCount));

    const remainder = boxCount % sqrt;

    columnCount = sqrt + (remainder === 0 ? remainder : 1);

    rowCount = Math.ceil(boxCount / columnCount);
  }

  return (
    <div
      className={`p-4 h-full w-full bg-red-500 grid lg:grid-flow-col grid-cols-1 sm:grid-cols-2 lg:grid-cols-${columnCount} lg:grid-rows-${rowCount} gap-4 md:gap-6 lg:gap-8 mx-auto`}
    >
      {boxArray.map((box) => (
        <ItemCard
          box={box}
          columnCount={columnCount}
          rowCount={rowCount}
          boxCount={boxCount}
        />
      ))}
    </div>
  );
};
