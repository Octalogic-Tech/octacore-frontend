import React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import {
  CustomPaperContainer,
  CustomTableCellBody,
  CustomTableCellHeader,
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
              <CustomTableCellHeader>column</CustomTableCellHeader>
              <CustomTableCellHeader align="left">column</CustomTableCellHeader>
              <CustomTableCellHeader align="left">column</CustomTableCellHeader>
              <CustomTableCellHeader align="left">column</CustomTableCellHeader>
              <CustomTableCellHeader align="left">column</CustomTableCellHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {supportTableData.map((_, index) => (
              <TableRow key={index}>
                <CustomTableCellBody component="th" scope="row">
                  column
                </CustomTableCellBody>
                <CustomTableCellBody align="left">column</CustomTableCellBody>
                <CustomTableCellBody align="left">column</CustomTableCellBody>
                <CustomTableCellBody align="left">column</CustomTableCellBody>
                <CustomTableCellBody align="left">column</CustomTableCellBody>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CustomTableContainer>
    </CustomPaperContainer>
  );
};
