import React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { CustomPaperContainer, CustomTableContainer } from '@octacore-frontend/constant';

export interface OutstandingTableProps {
  outstandingInvoice: Array<string>;
}

export const OutstandingTable: React.FC<OutstandingTableProps> = (props) => {
  const { outstandingInvoice } = props;

  return (
    <CustomPaperContainer >
      <CustomTableContainer >
        <Table
          size="small"
          aria-label="simple table"
          sx={{ minWidth: '600px' }}
        >
          <TableHead>
            <TableRow>
              <TableCell>column</TableCell>
              <TableCell align="left">column</TableCell>
              <TableCell align="left">column</TableCell>
              <TableCell align="left">column</TableCell>
              <TableCell align="left">column</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {outstandingInvoice.map((_, index) => (
              <TableRow key={index}>
                <TableCell component="th" scope="row">
                  column
                </TableCell>
                <TableCell align="left">column</TableCell>
                <TableCell align="left">column</TableCell>
                <TableCell align="left">column</TableCell>
                <TableCell align="left">column</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CustomTableContainer>
    </CustomPaperContainer>
  );
};
