import { IBox } from '../types/grid';

export const exceptions = [5, 7, 11, 13, 14, 17, 19, 21];


export const gridExceptionHandler = (boxCount: number, boxArray: IBox[]) => {
  let columnCount = 1;
  let rowCount = 1;
  switch (boxCount) {
    case 5: {
      rowCount = 2;
      columnCount = 3;

      boxArray[2]['rowspan'] = 2;
      break;
    }
    case 7: {
      rowCount = 2;
      columnCount = 4;
      boxArray[3]['colspan'] = 2;
      break;
    }
    case 11: {
      rowCount = 3;
      columnCount = 4;
      boxArray[4]['colspan'] = 2;
      break;
    }
    case 13: {
      rowCount = 3;
      columnCount = 5;
      boxArray[4]['rowspan'] = 2;
      boxArray[9]['rowspan'] = 2;
      break;
    }
    case 14: {
      rowCount = 3;
      columnCount = 5;
      boxArray[7]['rowspan'] = 2;
      break;
    }
    case 17: {
      rowCount = 4;
      columnCount = 5;
      boxArray[1]['rowspan'] = 2;
      boxArray[8]['rowspan'] = 2;
      boxArray[15]['rowspan'] = 2;
      break;
    }
    case 19: {
      rowCount = 4;
      columnCount = 5;
      boxArray[9]['rowspan'] = 2;
      break;
    }
    case 21: {
      rowCount = 4;
      columnCount = 6;
      boxArray[9]['colspan'] = 2;
      boxArray[10]['rowspan'] = 2;
      boxArray[12]['rowspan'] = 2;
      break;
    }
  }

  return {
    adjustedBoxArray: boxArray,
    adjustedRowCount: rowCount,
    adjustedColumnCount: columnCount,
  };
};
