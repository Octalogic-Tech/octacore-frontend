import React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import {
  CustomPaperContainer,
  CustomTableContainer,
} from '@octacore-frontend/constant';

export interface SupportProjectTableProps {
  supportTableData: Array<string>;
}

export const SupportProjectTable: React.FC<SupportProjectTableProps> = (
  props
) => {
  const { supportTableData } = props;

  return (
    <CustomPaperContainer>
      <CustomTableContainer>
        <Table size="small" aria-label="simple table">
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
            {supportTableData.map((_, index) => (
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
