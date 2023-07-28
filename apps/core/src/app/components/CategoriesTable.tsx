import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Menu,
} from '@mui/material';
import EditCategoryModal from './EditCategoryModal';
import { Delete, Edit, MoreVert } from '@mui/icons-material';
import {
  CategoriesTableProps,
  CategoryDataType,
  CustomMenuItem,
  CustomPaperContainer,
  CustomTableContainer,
  actionMenuParameter,
  columns,
  rows,
} from '@octacore-frontend/constant';

//Category table main Components--------------
function CategoriesTable({
  categoryData,
  fetchCategoryData,
}: CategoriesTableProps) {
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(5);
  const [editCategoryData, setEditCategoryData] = useState({
    id: 0,
    name: '',
    description: '',
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const [rowId, setRowId] = useState<number>(0);

  //Menu Open function start here -----------------
  const handleMenuClick = (
    event: React.MouseEvent<HTMLElement>,
    id: number | undefined
  ) => {
    if (id) {
      setRowId(id);
      setAnchorEl(event.currentTarget);
    }
  };
  //menu close function start here ---------------
  const handleMenuCloseClick = () => {
    setRowId(0);
    setAnchorEl(null);
  };

  //table data pegination function start here------------
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  //table data pegination function start here------------
  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  //category edited data handled here --------------
  const handleEditClick = () => {
    if (categoryData) {
      const index = categoryData.findIndex((row) => row.id === rowId);
      setEditCategoryData({
        id: rowId,
        name: categoryData[index].name,
        description: categoryData[index].description,
      });
      setEditModalOpen(true);
      setAnchorEl(null);
    }
  };

  //delete category data Api called here------------------
  const handleDeleteClick = () => {
    setAnchorEl(null);
  };

  //edit category api call
  function handleEdiCategorysubmit() {
    setEditModalOpen(false);
  }

  if (!categoryData) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <CustomPaperContainer>
        <CustomTableContainer>
          <Table size="small" stickyHeader aria-label="sticky table">
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    align={column.id === 'action' ? 'center' : 'left'}
                  >
                    {column.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {categoryData
                ?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row?: CategoryDataType) => {
                  return (
                    <TableRow key={row?.id}>
                      <TableCell align="left">{row?.name}</TableCell>
                      <TableCell align="left">{row?.created}</TableCell>
                      <TableCell align="left">{row?.updated}</TableCell>
                      <TableCell align="center">
                        <IconButton
                          aria-label="more"
                          id="long-button"
                          aria-controls={open ? 'long-menu' : undefined}
                          aria-expanded={open ? 'true' : undefined}
                          aria-haspopup="true"
                          onClick={(e) => handleMenuClick(e, row?.id)}
                          sx={{ padding: 0, margin: 0 }}
                        >
                          <MoreVert />
                        </IconButton>
                        <Menu
                          id="long-menu"
                          MenuListProps={{
                            'aria-labelledby': 'long-button',
                          }}
                          color="primary"
                          anchorEl={anchorEl}
                          open={open}
                          onClose={handleMenuCloseClick}
                          key={row?.id}
                          anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'left',
                          }}
                          transformOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                          }}
                          PaperProps={{
                            style: {
                              width: actionMenuParameter.menuWidth,
                              boxShadow: actionMenuParameter.menuShadowBox,
                            },
                          }}
                        >
                          <CustomMenuItem
                            key={row?.id}
                            onClick={handleEditClick}
                          >
                            <Edit /> Edit
                          </CustomMenuItem>
                          <CustomMenuItem onClick={handleDeleteClick}>
                            <Delete /> Delete
                          </CustomMenuItem>
                        </Menu>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CustomTableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 20]}
          component="div"
          count={rows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </CustomPaperContainer>
      <EditCategoryModal
        editCategoryData={editCategoryData}
        setEditCategoryData={setEditCategoryData}
        editModalOpen={editModalOpen}
        setEditModalOpen={setEditModalOpen}
        handleEdiCategorysubmit={handleEdiCategorysubmit}
      />
    </>
  );
}

export default CategoriesTable;
