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
    <Paper sx={{ width: { xs: '100vw', sm: '100%' }, overflow: 'hidden' }}>
      <TableContainer sx={{ maxHeight: 440 }}>
        <Table
          size="small"
          aria-label="simple table"
          sx={{ minWidth: '600px' }}
        >
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
            {outstandingInvoice.map((_, index) => (
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
    </Paper>
  );
};
