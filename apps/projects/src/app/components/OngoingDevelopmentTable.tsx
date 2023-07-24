import React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

export interface OngoingDevelopmentTableProps {
  ongoingDevelopmentTableData: Array<string>;
}

export const OngoingDevelopmentTable: React.FC<OngoingDevelopmentTableProps> = (props) => {
  const { ongoingDevelopmentTableData } = props;

  return (
    <TableContainer component={Paper} >
    <Table size="small" aria-label="simple table" >
      <TableHead>
        <TableRow>
          <TableCell>column</TableCell>
          <TableCell align="right">column</TableCell>
          <TableCell align="right">column</TableCell>
          <TableCell align="right">column</TableCell>
          <TableCell align="right">column</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {ongoingDevelopmentTableData.map((_, index) => (
          <TableRow key={index}>
            <TableCell component="th" scope="row">
              column
            </TableCell>
            <TableCell align="right">column</TableCell>
            <TableCell align="right">column</TableCell>
            <TableCell align="right">column</TableCell>
            <TableCell align="right">column</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
  );
};
