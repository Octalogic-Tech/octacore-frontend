import { ItemCard } from '../../components/ItemCard';
import { exceptions, gridExceptionHandler } from '../../utils/grid';
import { industries } from '../../mocked/industries';
import { IBox } from '../../types/grid';

export const Home = () => {
  const boxCount = industries.length;

  let boxArray: IBox[] = industries.map((industry, index) => {
    return { count: index + 1, rowspan: 1, colspan: 1, category: industry };
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
      className={`p-4 h-full w-ful grid lg:grid-flow-col grid-cols-1 sm:grid-cols-2 lg:grid-cols-${columnCount} lg:grid-rows-${rowCount} gap-4 md:gap-6 lg:gap-8 mx-auto`}
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
