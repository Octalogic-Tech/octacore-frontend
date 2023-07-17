import React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

export interface OutstandingTableProps {
  outstandingInvoice: Array<string>;
}

export const OutstandingTable: React.FC<OutstandingTableProps> = (props) => {
  const { outstandingInvoice } = props;

  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} size="small" aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>column</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              column
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              column
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              column
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>
              column
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {outstandingInvoice.map((_, index) => (
            <TableRow
              key={index}
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
            >
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
