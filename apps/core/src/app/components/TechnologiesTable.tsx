import React, { useState } from 'react';
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
import { Add, Delete, Edit, MoreVert } from '@mui/icons-material';
import {
    CustomMenuItem,
    CustomPaperContainer,
    CustomTableCellBody,
    CustomTableCellHeader,
    CustomTableContainer,
    actionMenuParameter,
    fabStyle,
    technologiesColumns,
} from '@octacore-frontend/constant';
import { useTheme } from '@mui/material';
import { servicesCoreTechnologies, technologiesDataType } from '@octacore-frontend/services/core-technologies'
import TechnologyAddDialog from './TechnologyAddDialog';
import TechnologyEditDialog from './TechnologyEditDialog';

//Category table main Components--------------
function TechnologiesTable() {
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(5);
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const [rowId, setRowId] = useState<number>(0);
    const { palette } = useTheme()
    const [technologyAddDialogOpen, setTehnologyAddDialogOpen] = useState(false)
    const [technologyEditDialogOpen, setTechnologyEditDialogOpen] = useState(false)
    const [technologyEditData, setEditTehnologyData] = useState({
        id: 0,
        name: "",
        description: ""
    })

    //react-Query----------------------
    const { isLoading, data, error, refetch, isFetching } = servicesCoreTechnologies()

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

    //Technology edited data handled here --------------
    const handleEditClick = () => {
        if (data) {
            const index = data.findIndex((row) => row.id === rowId);
            setEditTehnologyData({
                id: rowId,
                name: data[index].name,
                description: data[index].description,
            });
            setTechnologyEditDialogOpen(true);
            setAnchorEl(null);
        }
    };

    //delete Technology data Api called here------------------
    const handleDeleteClick = () => {
        setAnchorEl(null);
        refetch()
    };

    //handleNewcategory --
    const handleAddnewTechnology = () => {
        return
    }

    const handleEditTechnology = () => {
        return
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
                                {technologiesColumns.map((column) => (
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
                            {data
                                ?.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .map((row?: technologiesDataType) => {
                                    return (
                                        <TableRow key={row?.id}>
                                            <CustomTableCellBody align="left">{row?.name}</CustomTableCellBody>
                                            <CustomTableCellBody align="left">{row?.iconType}</CustomTableCellBody>
                                            <CustomTableCellBody align="left">{row?.iconName}</CustomTableCellBody>
                                            <CustomTableCellBody align="left">{row?.category}</CustomTableCellBody>
                                            <CustomTableCellBody align="left">{row?.description}</CustomTableCellBody>
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
                    count={data ? data.length : 1}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
            </CustomPaperContainer>

            <Fab
                aria-label="add"
                variant="extended"
                sx={fabStyle}
                onClick={() => setTehnologyAddDialogOpen(true)}
            >
                <Add />
                Add Technologies
            </Fab>
            <TechnologyAddDialog
                technologyAddDialogOpen={technologyAddDialogOpen}
                setTehnologyAddDialogOpen={setTehnologyAddDialogOpen}
                handleAddnewTechnology={handleAddnewTechnology} />
            <TechnologyEditDialog technologyEditDialogOpen={technologyEditDialogOpen}
                setTechnologyEditDialogOpen={setTechnologyEditDialogOpen}
                handleEditTechnology={handleEditTechnology}
                technologyEditData={technologyEditData}
                setEditTehnologyData={setEditTehnologyData} />

        </>
    );
}

export default TechnologiesTable;
