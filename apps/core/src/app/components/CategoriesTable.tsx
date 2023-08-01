import React, { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Menu,
  LinearProgress,
  Fab,
} from '@mui/material';
import EditCategoryModal from './EditCategoryModal';
import { Add, Delete, Edit, MoreVert } from '@mui/icons-material';
import {
  CategoryData,
  CategoryDataArrayType,
  CategoryDataType,
  CustomMenuItem,
  CustomPaperContainer,
  CustomTableCellBody,
  CustomTableCellHeader,
  CustomTableContainer,
  actionMenuParameter,
  columns,
  fabStyle,
} from '@octacore-frontend/constant';
import { useTheme } from '@mui/material';
import { fetchCategoryTableData, temporaryData } from '@octacore-frontend/services/categories'
import AddCategoryModal from './AddCategoryModal';

//Category table main Components--------------
function CategoriesTable() {
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
  const { palette } = useTheme()
  const [categoryData, setCategoryData] =
    useState<CategoryDataArrayType | null>(null);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [addCategoryTextFieldData, setAddCategoryTextFieldData] =
    useState<CategoryData>({ name: '', description: '' });


  //react-Query----------------------
  const { isLoading, data, error, refetch, isFetching } = fetchCategoryTableData()

  useMemo(() => {
    if (!data) return setCategoryData([]);

    const currentDate = new Date();

    setCategoryData(data.map((val: temporaryData) => ({
      id: val.id,
      name: val.title,
      description: val.body,
      updated: `${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`,
      created: `${currentDate.getMonth() + 1}/${currentDate.getFullYear() - 1}`,
    })))
  }, [data]);


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
    refetch()
  };

  //edit category api call-----------
  function handleEdiCategorysubmit() {
    setEditModalOpen(false);
    refetch()
  }

  //add new category refetch handle------------
  const handleAddNewCategory = () => {
    refetch()
  }

  if (isLoading || isFetching) {
    return <LinearProgress color='secondary' />;
  }

  if (error) {
    return <h1>Error occurred</h1>
  }

  return (
    <>
      <CustomPaperContainer>
        <CustomTableContainer>
          <Table size="small" stickyHeader aria-label="sticky table">
            <TableHead>
              <TableRow >
                {columns.map((column) => (
                  <CustomTableCellHeader
                    key={column.id}
                    align={column.id === 'action' ? 'center' : 'left'}
                    sx={{ background: palette.background.paper }}
                  >
                    {column.label}
                  </CustomTableCellHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {categoryData
                ?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((row?: CategoryDataType) => {
                  return (
                    <TableRow key={row?.id}>
                      <CustomTableCellBody align="left">{row?.name}</CustomTableCellBody>
                      <CustomTableCellBody align="left">{row?.created}</CustomTableCellBody>
                      <CustomTableCellBody align="left">{row?.updated}</CustomTableCellBody>
                      <CustomTableCellBody align="center">
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
                      </CustomTableCellBody>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CustomTableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 20]}
          component="div"
          count={categoryData ? categoryData.length : 1}
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
      <Fab
        aria-label="add"
        variant="extended"
        sx={fabStyle}
        onClick={() => setAddCategoryOpen(true)}
      >
        <Add />
        Add Categories
      </Fab>
      <AddCategoryModal
        addCategoryOpen={addCategoryOpen}
        setAddCategoryOpen={setAddCategoryOpen}
        addCategoryTextFieldData={addCategoryTextFieldData}
        setAddCategoryTextFieldData={setAddCategoryTextFieldData}
        handleAddNewCategory={handleAddNewCategory}
      />
    </>
  );
}

export default CategoriesTable;
